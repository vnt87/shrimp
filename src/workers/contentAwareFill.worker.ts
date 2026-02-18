/**
 * Content-Aware Fill — Web Worker
 *
 * Runs PatchMatch inpainting off the main thread so the UI never freezes.
 * Communicates with the main thread via structured clone / Transferable messages.
 *
 * Message protocol:
 *
 *   Main → Worker:
 *     { type: 'fill', id, imageData, maskData, options }
 *     { type: 'preload' }   ← optional early warm-up
 *
 *   Worker → Main:
 *     { type: 'progress', id, progress }   ← 0–1
 *     { type: 'result',   id, imageData }  ← Transferable
 *     { type: 'error',    id, message }
 *     { type: 'ready' }                    ← after preload
 */

import { contentAwareFill, loadCAFModule } from '../utils/contentAwareFill'
import type { ContentAwareFillOptions } from '../utils/contentAwareFill'

// ---------------------------------------------------------------------------
// Message type definitions
// ---------------------------------------------------------------------------

interface PreloadMessage {
    type: 'preload'
}

interface FillMessage {
    type: 'fill'
    /** Unique request identifier — echoed back in all response messages. */
    id: string
    /** Full-canvas RGBA image data */
    imageData: ImageData
    /** Binary mask: white = inpaint, black = keep */
    maskData: ImageData
    options: ContentAwareFillOptions
}

type IncomingMessage = PreloadMessage | FillMessage

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
    const { type } = event.data

    if (type === 'preload') {
        // Warm up: load the WASM module in the background so the first
        // actual fill request doesn't pay the full load cost.
        try {
            await loadCAFModule()
            self.postMessage({ type: 'ready' })
        } catch (err) {
            self.postMessage({
                type: 'error',
                id: undefined,
                message: err instanceof Error ? err.message : 'WASM preload failed',
            })
        }
        return
    }

    if (type === 'fill') {
        const { id, imageData, maskData, options } = event.data

        try {
            // Run the fill, forwarding progress updates back to the main thread
            const resultImageData = await contentAwareFill(imageData, maskData, {
                ...options,
                onProgress: (progress: number) => {
                    self.postMessage({ type: 'progress', id, progress })
                },
            })

            // Transfer the underlying ArrayBuffer so it doesn't get copied —
            // the data can be gigabytes for large images, so avoiding a copy
            // is important.
            // Use the options-object form of postMessage so TypeScript recognises
            // the DedicatedWorkerGlobalScope overload correctly.
            self.postMessage(
                { type: 'result', id, imageData: resultImageData },
                { transfer: [resultImageData.data.buffer] }
            )
        } catch (err) {
            self.postMessage({
                type: 'error',
                id,
                message: err instanceof Error ? err.message : 'Fill failed',
            })
        }
    }
}

// Required so Vite / TypeScript treat this as an ES module
export {}
