/**
 * Content-Aware Fill — Core Utility
 *
 * Provides on-device, offline-capable image inpainting using the CImg
 * PatchMatch algorithm compiled to WebAssembly (public/wasm/caf.wasm).
 *
 * Key responsibilities:
 *  - Lazy-load the WASM module (only on first use)
 *  - Generate binary mask ImageData from any Selection type (rect/ellipse/path)
 *  - Run the inpainting algorithm via raw WASM heap pointers
 *  - Return the filled image as a new ImageData
 *
 * This module is intended to be called from contentAwareFill.worker.ts
 * so all processing stays off the main thread.
 */

import type { Selection } from '../components/EditorContext'

// ---------------------------------------------------------------------------
// WASM Module Types
// ---------------------------------------------------------------------------

/**
 * Shape of the Emscripten-generated CAFModule object.
 * `inpaintImage` and `getBufferSize` are bound via EMSCRIPTEN_BINDINGS.
 * `_malloc` / `_free` are exposed via EXPORTED_FUNCTIONS.
 */
interface CAFModuleInstance {
    /** Allocate `size` bytes on the WASM heap; returns pointer. */
    _malloc(size: number): number
    /** Free a previously allocated heap pointer. */
    _free(ptr: number): void
    /** View of the full WASM linear memory as unsigned bytes. */
    HEAPU8: Uint8Array
    /**
     * In-place inpaint: fills masked pixels in the image buffer.
     * Both imgPtr and maskPtr point to RGBA byte sequences on the heap.
     */
    inpaintImage(
        imgPtr: number,
        maskPtr: number,
        width: number,
        height: number,
        patchSize: number,
        iterations: number
    ): void
    /** Returns width * height * 4 (RGBA byte count). */
    getBufferSize(width: number, height: number): number
}

// ---------------------------------------------------------------------------
// Module singleton — loaded once, cached for subsequent calls
// ---------------------------------------------------------------------------

let _moduleInstance: CAFModuleInstance | null = null
let _loadingPromise: Promise<CAFModuleInstance> | null = null

/**
 * Lazily load the CImg WASM module.
 * Subsequent calls immediately return the cached instance.
 *
 * @throws Error if the WASM binary has not been built yet (public/wasm/caf.js missing)
 */
export async function loadCAFModule(): Promise<CAFModuleInstance> {
    // Return cached instance immediately
    if (_moduleInstance) return _moduleInstance

    // Deduplicate concurrent load requests
    if (_loadingPromise) return _loadingPromise

    _loadingPromise = (async (): Promise<CAFModuleInstance> => {
        // Dynamic import of the Emscripten-generated JS glue code.
        // Vite serves public/ at the root; @vite-ignore silences the dynamic-import warning.
        // @ts-ignore — /wasm/caf.js is a static asset, not a TS module; types live in src/types/caf-module.d.ts
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        const { default: createModule } = await import(/* @vite-ignore */ '/wasm/caf.js')
        const mod = await createModule() as CAFModuleInstance
        _moduleInstance = mod
        return mod
    })()

    return _loadingPromise
}

/** Returns true once the WASM module is fully initialized. */
export function isCAFModuleReady(): boolean {
    return _moduleInstance !== null
}

// ---------------------------------------------------------------------------
// Mask Generation
// ---------------------------------------------------------------------------

/**
 * Convert a Selection into a binary ImageData mask.
 *
 * - White (R=255) pixels mark the region to be filled (inpainted).
 * - Black (R=0)   pixels are preserved as-is.
 *
 * Handles all three Selection types the editor supports:
 *   'rect'    → filled rectangle
 *   'ellipse' → filled ellipse
 *   'path'    → filled polygon using scanline fill
 */
export function selectionToMask(
    selection: Selection,
    canvasWidth: number,
    canvasHeight: number
): ImageData {
    // Offscreen canvas approach — uses the browser's own rasterizer for
    // ellipse / path shapes, ensuring pixel-perfect anti-aliased edges.
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = canvasWidth
    maskCanvas.height = canvasHeight
    const ctx = maskCanvas.getContext('2d')!

    // Black background → pixels to keep
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // White fill → pixels to inpaint
    ctx.fillStyle = '#ffffff'

    switch (selection.type) {
        case 'rect':
            ctx.fillRect(selection.x, selection.y, selection.width, selection.height)
            break

        case 'ellipse': {
            const rx = selection.width / 2
            const ry = selection.height / 2
            const cx = selection.x + rx
            const cy = selection.y + ry
            ctx.beginPath()
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
            ctx.fill()
            break
        }

        case 'path': {
            if (!selection.path || selection.path.length < 3) {
                // Fallback to bounding rect if path is degenerate
                ctx.fillRect(selection.x, selection.y, selection.width, selection.height)
            } else {
                ctx.beginPath()
                ctx.moveTo(selection.path[0].x, selection.path[0].y)
                for (let i = 1; i < selection.path.length; i++) {
                    ctx.lineTo(selection.path[i].x, selection.path[i].y)
                }
                ctx.closePath()
                ctx.fill()
            }
            break
        }
    }

    return ctx.getImageData(0, 0, canvasWidth, canvasHeight)
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Tuning parameters for the PatchMatch inpainting pass.
 *
 * Higher values improve quality at the cost of processing time.
 * Defaults (patchSize=9, iterations=4) balance quality and speed for typical
 * web-browser use cases.
 */
export interface ContentAwareFillOptions {
    /**
     * Patch size for PatchMatch texture search.
     * Must be odd; recommended range 5–13.
     * Larger = better texture quality, slower.
     * @default 9
     */
    patchSize?: number
    /**
     * Number of PatchMatch refinement passes.
     * Recommended range 3–6.
     * More passes = better quality, slower.
     * @default 4
     */
    iterations?: number
    /**
     * Optional progress callback. Receives values in [0, 1].
     * Called at key milestones (module load, pre/post inpaint).
     */
    onProgress?: (progress: number) => void
}

// ---------------------------------------------------------------------------
// Main Fill Function
// ---------------------------------------------------------------------------

/**
 * Apply content-aware fill to `sourceImageData` in the region defined by `mask`.
 *
 * Both inputs must have the same dimensions (width × height).
 * White pixels in `mask` are filled; all others are unchanged.
 *
 * This is CPU-intensive. Always call from a Web Worker:
 *   src/workers/contentAwareFill.worker.ts
 *
 * @param sourceImageData Full-canvas RGBA image data
 * @param mask            Binary mask (white = fill, black = keep)
 * @param options         Tuning parameters
 * @returns               New ImageData with filled region applied
 */
export async function contentAwareFill(
    sourceImageData: ImageData,
    mask: ImageData,
    options: ContentAwareFillOptions = {}
): Promise<ImageData> {
    const {
        patchSize = 9,
        iterations = 4,
        onProgress,
    } = options

    const { width, height } = sourceImageData

    // Validate dimensions match
    if (mask.width !== width || mask.height !== height) {
        throw new Error(
            `contentAwareFill: mask dimensions (${mask.width}×${mask.height}) ` +
            `must match image dimensions (${width}×${height})`
        )
    }

    // 1. Load WASM module
    onProgress?.(0.05)
    const mod = await loadCAFModule()
    onProgress?.(0.15)

    const byteLength = width * height * 4

    // 2. Allocate buffers on the WASM heap
    const imgPtr  = mod._malloc(byteLength)
    const maskPtr = mod._malloc(byteLength)

    if (imgPtr === 0 || maskPtr === 0) {
        // Free whatever was allocated before throwing
        if (imgPtr)  mod._free(imgPtr)
        if (maskPtr) mod._free(maskPtr)
        throw new Error('contentAwareFill: WASM heap allocation failed (out of memory?)')
    }

    try {
        // 3. Copy image and mask data into the WASM heap
        mod.HEAPU8.set(sourceImageData.data, imgPtr)
        mod.HEAPU8.set(mask.data, maskPtr)
        onProgress?.(0.25)

        // 4. Run PatchMatch inpainting in-place on imgPtr
        mod.inpaintImage(imgPtr, maskPtr, width, height, patchSize, iterations)
        onProgress?.(0.90)

        // 5. Copy result out of the WASM heap into a new Uint8ClampedArray
        //    `.slice()` is critical here — it creates an owned copy, so we can
        //    safely free the WASM heap buffer before returning.
        const resultBytes = new Uint8ClampedArray(
            mod.HEAPU8.buffer,
            imgPtr,
            byteLength
        ).slice()

        onProgress?.(1.0)
        return new ImageData(resultBytes, width, height)

    } finally {
        // 6. Always free WASM heap buffers — even if inpainting throws
        mod._free(imgPtr)
        mod._free(maskPtr)
    }
}

// ---------------------------------------------------------------------------
// Convenience: extract full layer canvas as ImageData
// ---------------------------------------------------------------------------

/**
 * Extract all pixel data from an HTMLCanvasElement.
 * Returns a full-canvas ImageData suitable for passing to `contentAwareFill`.
 */
export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvasToImageData: could not get 2d context')
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Write filled pixels back to a canvas.
 * Only pixels where `mask` is white (R > 128) are composited from `filled`;
 * unchanged pixels from `original` are written otherwise — ensuring areas
 * outside the selection are never touched.
 */
export function applyFillToCanvas(
    targetCanvas: HTMLCanvasElement,
    filled: ImageData,
    mask: ImageData,
    original: ImageData
): void {
    const { width, height } = filled

    // Build a composite ImageData: filled inside mask, original outside
    const composite = new ImageData(new Uint8ClampedArray(original.data), width, height)

    for (let i = 0; i < mask.data.length; i += 4) {
        if (mask.data[i] > 128) {
            // Inside fill region — use inpainted values
            composite.data[i]     = filled.data[i]
            composite.data[i + 1] = filled.data[i + 1]
            composite.data[i + 2] = filled.data[i + 2]
            composite.data[i + 3] = filled.data[i + 3]
        }
        // Outside fill region — keeps original values (already there)
    }

    const ctx = targetCanvas.getContext('2d')
    if (!ctx) throw new Error('applyFillToCanvas: could not get 2d context')
    ctx.putImageData(composite, 0, 0)
}
