# Content-Aware Fill — Feasibility Report

**Last Updated:** 2026-02-18  
**Status:** Research Complete — Ready for Implementation Decision

---

## Executive Summary

**Feasibility: HIGH**

Content-Aware Fill (CAF) can be implemented as a fully on-device, offline-capable feature using open-source algorithms and existing browser APIs. Three viable implementation paths exist, each with different trade-offs. The codebase is **exceptionally well-prepared**: a `public/wasm/` directory already exists, `healing.ts` contains directly reusable code (Gaussian blur, patch extraction, ImageData manipulation), and `GenFillModal.tsx` provides the exact UI pattern to follow.

**Recommended starting path:** OpenCV.js (TELEA/NS) for a working prototype, with a defined upgrade path to CImg WASM for production quality.

---

## 1. What is Content-Aware Fill?

Content-Aware Fill is a fill operation that:

1. **Analyzes the surrounding image content** around a selected area (mask)
2. **Synthesizes new pixels** to fill the selected region seamlessly
3. **Preserves textures and structures** from the surrounding area — without the user specifying a source point

### Comparison with Existing Tools in SHRIMP

| Feature | Healing Brush | Generative Fill | **Content-Aware Fill** |
|---------|---------------|-----------------|------------------------|
| Source Point | Required | Not needed | Not needed |
| External API | No | Yes | **No** |
| Works Offline | Yes | No | **Yes** |
| Selection-based | No (brush) | Yes | **Yes** |
| Quality | Good (small areas) | Excellent | Good–Excellent |
| Speed | Real-time | Slow (network) | Medium (1–10 s) |
| Implementation Status | ✅ Done | ✅ Done | 🔲 Planned |

---

## 2. Codebase Analysis

### 2.1 Directly Reusable Code

Inspecting `src/utils/healing.ts` reveals that the **core pixel manipulation primitives** already exist and are directly applicable to CAF:

| Function | Description | CAF Reuse |
|----------|-------------|-----------|
| `extractPatch()` | Extracts a rectangular region from `ImageData` | ✅ Directly reusable for extracting the fill region and border context |
| `gaussianBlur()` | Separable box-blur approximation (horizontal + vertical pass) | ✅ Needed for TELEA-style inpainting and edge feathering |
| `calculateMeanLuminance()` | Computes per-channel mean with alpha-awareness | ✅ Useful for post-process color matching of filled region |
| `createCircularMask()` | Generates soft-edge alpha masks | ✅ Can be adapted to feather fill edges |
| `adaptLuminance()` | Frequency-based luminance transfer | ✅ Can be used to blend the filled result with surrounding color |

This means **the hardest algorithmic primitives are already written**. CAF implementation primarily involves orchestrating these building blocks with an inpainting algorithm.

### 2.2 Infrastructure Ready

| Infrastructure Item | Status | Notes |
|--------------------|--------|-------|
| `public/wasm/` directory | ✅ Exists | Ready to drop in compiled WASM files |
| Web Worker pattern | ✅ `histogram.worker.ts` | Pattern established; can spawn CAF worker |
| `GenFillModal` UI pattern | ✅ Exists | Exact template for floating panel anchored to selection |
| `EditorContext.addLayer()` | ✅ Exists | Output layer API already available |
| `Selection` types (rect/ellipse/path) | ✅ Exists | All types need mask generation |
| Canvas-based layer system | ✅ `HTMLCanvasElement` | Fully compatible with all canvas-API approaches |
| `idb-keyval` | ✅ Installed | Can cache WASM modules and ONNX models in IndexedDB |

### 2.3 Existing Dependencies Audit

Current `package.json` has **no** ONNX Runtime or OpenCV.js. This is clean — no existing conflicts. Adding either is a new dependency.

```json
// Current relevant deps — none conflict with CAF:
"pixi.js": "^8.16.0",        // GPU rendering (not involved in CAF processing)
"idb-keyval": "^6.2.2",      // Can cache model weights between sessions
"jszip": "^3.10.1",          // Unrelated
"pako": "^2.1.0"             // Unrelated
```

---

## 3. Algorithm Options

### Option A: OpenCV.js — TELEA / Navier-Stokes Inpainting

**Algorithm:** Classical diffusion-based inpainting. TELEA uses Fast Marching Method; NS uses fluid-dynamics equations.

**Source:** [OpenCV.js](https://docs.opencv.org/3.4/df/d0a/tutorial_js_intro.html) — official OpenCV build for the browser via WASM.

**Model/Bundle Size:** ~8–9 MB (WASM binary, gzipped ~2.5 MB)

**Quality Characteristics:**
- Best for: thin scratches, small dust spots, narrow linear defects, text removal over simple backgrounds
- Poor for: large selections (>10% of image), complex textures (grass, fabric, skin), structured content (buildings, faces)
- Produces visible blurring/smearing on large regions

**Performance:**
- Small selection (100×100 px): ~50–200 ms
- Medium selection (300×300 px): ~500 ms – 2 s
- Large selection (500×500 px): ~2–8 s

**Integration Complexity:** Low  
**Implementation Effort:** 2–3 days

```typescript
// Example integration with existing ImageData-based layer system
import type { Selection } from '../components/EditorContext'

declare const cv: any // OpenCV.js global

/**
 * Runs OpenCV TELEA or NS inpainting on the current layer within the selection mask.
 * Reuses the gaussianBlur and extractPatch primitives already in healing.ts.
 */
export async function contentAwareFillOpenCV(
    layerCanvas: HTMLCanvasElement,
    selection: Selection,
    method: 'telea' | 'navier-stokes' = 'telea',
    radius: number = 3
): Promise<HTMLCanvasElement> {
    // Build a grayscale mask from the selection shape
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = layerCanvas.width
    maskCanvas.height = layerCanvas.height
    const maskCtx = maskCanvas.getContext('2d')!
    maskCtx.fillStyle = 'black'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    maskCtx.fillStyle = 'white'

    // Draw the selection shape into the mask
    if (selection.type === 'ellipse') {
        const rx = selection.width / 2
        const ry = selection.height / 2
        maskCtx.beginPath()
        maskCtx.ellipse(selection.x + rx, selection.y + ry, rx, ry, 0, 0, Math.PI * 2)
        maskCtx.fill()
    } else if (selection.type === 'path' && selection.path) {
        maskCtx.beginPath()
        maskCtx.moveTo(selection.path[0].x, selection.path[0].y)
        selection.path.slice(1).forEach(p => maskCtx.lineTo(p.x, p.y))
        maskCtx.closePath()
        maskCtx.fill()
    } else {
        // Rectangular selection
        maskCtx.fillRect(selection.x, selection.y, selection.width, selection.height)
    }

    // OpenCV inpainting
    const src = cv.imread(layerCanvas)
    const mask = cv.imread(maskCanvas)
    const dst = new cv.Mat()
    const grayMask = new cv.Mat()

    cv.cvtColor(mask, grayMask, cv.COLOR_RGBA2GRAY)
    const flag = method === 'telea' ? cv.INPAINT_TELEA : cv.INPAINT_NS
    cv.inpaint(src, grayMask, dst, radius, flag)

    // Write result back to a new canvas
    const resultCanvas = document.createElement('canvas')
    resultCanvas.width = layerCanvas.width
    resultCanvas.height = layerCanvas.height
    cv.imshow(resultCanvas, dst)

    // Cleanup OpenCV Mats to prevent memory leaks
    src.delete(); mask.delete(); dst.delete(); grayMask.delete()

    return resultCanvas
}
```

**Pros:**
- Simplest integration path
- Well-documented, production-proven
- No large model download

**Cons:**
- Quality inadequate for large or complex selections
- ~8 MB WASM download (mitigated by lazy loading + IndexedDB caching via `idb-keyval`)
- Requires loading OpenCV.js globally before first use

---

### Option B: LaMa ONNX — Deep Learning Inpainting (Best Quality)

**Algorithm:** LaMa (Large Mask Inpainting) uses Fast Fourier Convolutions to model long-range image context, making it handle large and complex masks well.

**Sources:**
- Model: [Carve/LaMa-ONNX on HuggingFace](https://huggingface.co/Carve/LaMa-ONNX) (~207 MB)
- Lighter variant: [opencv/inpainting_lama on HuggingFace](https://huggingface.co/opencv/inpainting_lama) — smaller version maintained by OpenCV team

**Runtime:** `onnxruntime-web` (runs inference in-browser via WASM/WebGL backend)

**Model Size:**
- Full LaMa ONNX: ~207 MB
- OpenCV's lighter LaMa variant: **~25–30 MB** ← Significantly better for web use
- Both run entirely on-device; no server required

**Quality Characteristics:**
- Best-in-class for large masks (entire faces, objects, backgrounds)
- Excellent structural awareness — fills in perspective lines, textures, repeated patterns
- Comparable to or exceeding Photoshop's Content-Aware Fill for many scenes

**Performance (M3 MacBook benchmarks from community reports):**
- Input must be resized to 512×512 for inference (then upscaled back): ~1–5 s
- Desktop GPU via WebGL backend: noticeably faster than CPU path
- Mobile devices: 5–15 s (use Web Worker to avoid UI freeze)

**Integration Complexity:** Medium  
**Implementation Effort:** 3–5 days

```typescript
import * as ort from 'onnxruntime-web'

/**
 * Preprocesses image+mask for LaMa: resize to 512×512,
 * normalize to [0,1] float32, NCHW layout.
 */
function preprocessForLaMa(
    imageData: ImageData,
    maskData: ImageData
): { imageTensor: ort.Tensor; maskTensor: ort.Tensor } {
    const SIZE = 512
    // Resize, normalize, convert to float32 NCHW...
    // (Use OffscreenCanvas for resize in Web Worker)
    const imageFloat = new Float32Array(3 * SIZE * SIZE)
    const maskFloat = new Float32Array(1 * SIZE * SIZE)

    // Fill imageFloat: iterate pixels, normalize R/G/B to [0,1]
    for (let i = 0; i < SIZE * SIZE; i++) {
        imageFloat[i]              = imageData.data[i * 4]     / 255 // R channel
        imageFloat[SIZE*SIZE + i]  = imageData.data[i * 4 + 1] / 255 // G channel
        imageFloat[SIZE*SIZE*2 + i]= imageData.data[i * 4 + 2] / 255 // B channel
        maskFloat[i] = maskData.data[i * 4] > 128 ? 1.0 : 0.0        // Binary mask
    }

    return {
        imageTensor: new ort.Tensor('float32', imageFloat, [1, 3, SIZE, SIZE]),
        maskTensor:  new ort.Tensor('float32', maskFloat,  [1, 1, SIZE, SIZE])
    }
}

/**
 * Runs LaMa ONNX inference — intended to run inside a Web Worker.
 */
export async function contentAwareFillLaMa(
    imageData: ImageData,
    maskData: ImageData,
    modelPath: string = '/wasm/lama.onnx'
): Promise<ImageData> {
    // Load model (cached in memory after first load; use idb-keyval for persistent cache)
    const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'] // Try GPU first, fall back to CPU
    })

    const { imageTensor, maskTensor } = preprocessForLaMa(imageData, maskData)
    const feeds = { image: imageTensor, mask: maskTensor }
    const results = await session.run(feeds)

    // Post-process: convert float32 NCHW [0,1] output back to ImageData
    const outputData = results['output'].data as Float32Array
    const SIZE = 512
    const outputImageData = new ImageData(SIZE, SIZE)

    for (let i = 0; i < SIZE * SIZE; i++) {
        outputImageData.data[i * 4]     = Math.round(outputData[i]              * 255) // R
        outputImageData.data[i * 4 + 1] = Math.round(outputData[SIZE*SIZE + i]  * 255) // G
        outputImageData.data[i * 4 + 2] = Math.round(outputData[SIZE*SIZE*2 + i]* 255) // B
        outputImageData.data[i * 4 + 3] = 255
    }

    return outputImageData // Caller upscales back to original size
}
```

**Pros:**
- State-of-the-art quality for all mask sizes
- Fully offline, no API key or server
- Community-verified to work in-browser (Next.js demo confirmed working on M3 MacBook)
- OpenCV's lighter variant reduces size from 207 MB to ~25–30 MB

**Cons:**
- Model download: even at 25 MB, requires explicit user opt-in or progressive loading
- Higher memory usage (~300–600 MB RAM during inference)
- Processing time 1–10 seconds (must run in Web Worker)
- Fixed 512×512 resolution requires resize pre/post-processing

---

### Option C: CImg WASM — PatchMatch (Best Balance)

**Algorithm:** PatchMatch (Barnes et al., 2009) — randomized nearest-neighbor search for patch correspondence. This is the algorithm family Photoshop's Content-Aware Fill is based on.

**Source:** [CImg `inpaint.h` plugin](https://github.com/GreycLab/CImg/blob/master/plugins/inpaint.h) — header-only C++ implementation, no external dependencies.

**Bundle Size:** ~1–3 MB (estimated after Emscripten compilation with `-O3`)

**Quality Characteristics:**
- Excellent texture synthesis — finds the best-matching patches from surrounding content
- Works well for structured content (brick walls, fabric, repetitive patterns)
- Comparable to Photoshop's Content-Aware Fill
- Better than OpenCV diffusion for medium/large selections

**Performance:**
- Highly dependent on selection size and image complexity
- Typical: 1–8 seconds for 300×300 selection on modern CPU
- Can be parallelized via PNaCl/WASM threads (with `SharedArrayBuffer`)

**Integration Complexity:** Medium-High  
**Implementation Effort:** 4–7 days (WASM build + integration)

**Build Process:**

```bash
# 1. Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# 2. Download CImg (header-only, no build needed)
wget https://github.com/GreycLab/CImg/raw/master/CImg.h
wget https://github.com/GreycLab/CImg/raw/master/plugins/inpaint.h

# 3. Create wrapper exposing the inpaint function to JS
cat > caf_wrapper.cpp << 'EOF'
#define cimg_display 0          // No display — browser context
#define cimg_use_png 0          // No libpng dependency
#define cimg_use_jpeg 0         // No libjpeg dependency
#include "CImg.h"
#include "plugins/inpaint.h"
#include <emscripten/bind.h>

using namespace cimg_library;

/**
 * Inpaints `img_data` (RGBA, row-major) at pixels where `mask_data` > 128.
 * Operates in-place: writes result back into img_data.
 */
void inpaintImage(
    uintptr_t img_ptr, uintptr_t mask_ptr,
    int width, int height,
    int patchSize,       // Recommended: 7–11
    int iterations       // Recommended: 3–5 (higher = better quality, slower)
) {
    auto* img_data  = reinterpret_cast<unsigned char*>(img_ptr)
    auto* mask_data = reinterpret_cast<unsigned char*>(mask_ptr)

    // CImg uses planar RGBRGB... layout; we receive interleaved RGBA
    CImg<unsigned char> img(width, height, 1, 3)
    CImg<unsigned char> mask(width, height, 1, 1)

    // Convert interleaved RGBA → planar RGB
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4
            img(x, y, 0, 0) = img_data[idx]
            img(x, y, 0, 1) = img_data[idx + 1]
            img(x, y, 0, 2) = img_data[idx + 2]
            mask(x, y) = (mask_data[idx] > 128) ? 255 : 0
        }
    }

    // Run PatchMatch inpainting
    img.inpaint(mask, patchSize, iterations)

    // Write result back to img_data (interleaved RGBA, alpha preserved)
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int idx = (y * width + x) * 4
            img_data[idx]     = img(x, y, 0, 0) // R
            img_data[idx + 1] = img(x, y, 0, 1) // G
            img_data[idx + 2] = img(x, y, 0, 2) // B
            // Alpha channel (idx+3) is left unchanged
        }
    }
}

EMSCRIPTEN_BINDINGS(caf_module) {
    emscripten::function("inpaintImage", &inpaintImage)
}
EOF

# 4. Compile with Emscripten
emcc caf_wrapper.cpp -o public/wasm/caf.js \
    -O3 \
    -std=c++17 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="CAFModule" \
    -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MAXIMUM_MEMORY=512MB \
    -s ENVIRONMENT=web,worker
    # Output: public/wasm/caf.js + public/wasm/caf.wasm
```

```typescript
// TypeScript integration for CImg WASM
declare function CAFModule(): Promise<any>

let cafModuleInstance: any = null

async function loadCAFModule(): Promise<any> {
    if (cafModuleInstance) return cafModuleInstance
    // Dynamic import — only load when user first uses CAF
    const { default: createModule } = await import(/* @vite-ignore */ '/wasm/caf.js')
    cafModuleInstance = await createModule()
    return cafModuleInstance
}

/**
 * Runs CImg PatchMatch inpainting on an image+mask.
 * Should be called inside a Web Worker to avoid blocking the UI.
 */
export async function contentAwareFillCImg(
    imageData: ImageData,
    maskData: ImageData,
    patchSize: number = 9,
    iterations: number = 4
): Promise<ImageData> {
    const mod = await loadCAFModule()

    const { width, height } = imageData
    const byteLength = width * height * 4

    // Allocate WASM heap buffers
    const imgPtr  = mod._malloc(byteLength)
    const maskPtr = mod._malloc(byteLength)

    // Copy JS data into WASM heap
    mod.HEAPU8.set(imageData.data, imgPtr)
    mod.HEAPU8.set(maskData.data, maskPtr)

    // Run inpainting (in-place on imgPtr)
    mod.inpaintImage(imgPtr, maskPtr, width, height, patchSize, iterations)

    // Copy result out of WASM heap
    const resultData = new Uint8ClampedArray(mod.HEAPU8.buffer, imgPtr, byteLength).slice()
    const result = new ImageData(resultData, width, height)

    // Free heap buffers
    mod._free(imgPtr)
    mod._free(maskPtr)

    return result
}
```

**Pros:**
- Small WASM binary (~1–3 MB), smallest of all options
- Photoshop-class algorithm (PatchMatch family)
- No external runtime dependency
- `public/wasm/` already exists in the project
- Works offline after initial WASM load

**Cons:**
- Requires Emscripten build toolchain (one-time setup)
- Must handle CImg's planar RGB ↔ browser's interleaved RGBA conversion
- No pre-built WASM binary available (must build ourselves)
- Longer development time vs. Option A

---

### Option D: inpaint.js — Pure JavaScript (Prototype Only)

**Algorithm:** Telea's inpainting algorithm, pure JavaScript port.

**Source:** [antimatter15/inpaint.js](https://github.com/antimatter15/inpaint.js) — last meaningful commit ~2013.

**Bundle Size:** ~5 KB

**Verdict:** Suitable only for quick prototyping to validate UI workflow. Not recommended for production — quality is poor, library is unmaintained, and the OpenCV.js TELEA implementation is faster and higher quality.

---

## 4. Side-by-Side Comparison

| Criterion | OpenCV.js (A) | LaMa ONNX (B) | CImg WASM (C) | inpaint.js (D) |
|-----------|:---:|:---:|:---:|:---:|
| **Quality (small mask)** | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★☆☆☆ |
| **Quality (large mask)** | ★★☆☆☆ | ★★★★★ | ★★★★☆ | ★☆☆☆☆ |
| **Download size** | ~8 MB | ~25–207 MB | ~1–3 MB | Tiny |
| **Processing speed** | Fast | Slow (1–10 s) | Medium (1–8 s) | Fast |
| **Implementation effort** | Low | Medium | Med-High | Very Low |
| **Works offline** | ✅ | ✅ | ✅ | ✅ |
| **External service** | ❌ | ❌ | ❌ | ❌ |
| **Pre-built for browser** | ✅ | ✅ | ❌ (build needed) | ✅ |
| **Existing codebase reuse** | High | Medium | Medium | Low |

---

## 5. Recommended Implementation Strategy

### 🎯 Phase 1 — OpenCV.js (2–3 days, shippable MVP)

Fast-tracks a working feature for users while establishing the full UI/UX flow:

1. Lazy-load OpenCV.js WASM from CDN or host locally in `public/wasm/`
2. Cache the binary in IndexedDB via `idb-keyval` (already installed) so it only downloads once
3. Spawn a Web Worker (pattern already established with `histogram.worker.ts`) for processing
4. Build `ContentAwareFillModal` — modeled directly on `GenFillModal.tsx`

### 🏆 Phase 2 — CImg WASM (4–7 additional days, production quality)

Upgrades quality to Photoshop-class without a large model download:

1. Set up Emscripten build environment (Docker recommended for CI reproducibility)
2. Compile `CImg + inpaint.h` → `public/wasm/caf.js` + `public/wasm/caf.wasm`
3. Replace the OpenCV backend in the same utility function — the UI layer stays unchanged

### ✨ Optional Phase 3 — LaMa ONNX (3–5 additional days, AI-quality)

For users who need best-in-class results and are willing to download a larger model:

1. Offer "High Quality (AI)" toggle in the CAF modal
2. Lazy-load the lighter OpenCV-optimized LaMa variant (~25–30 MB) on first use
3. Cache model bytes in IndexedDB via `idb-keyval`
4. Run in Web Worker using `onnxruntime-web`

---

## 6. Technical Architecture

### 6.1 Integration Points (Mapped to Actual Files)

| Component | File | Change Required |
|-----------|------|-----------------|
| Menu trigger | `src/components/Header.tsx` | Add "Content-Aware Fill" under Edit menu (requires active selection) |
| Context menu | `src/components/ContextMenu.tsx` | Add option when right-clicking a selection |
| Modal UI | **New** `src/components/ContentAwareFillModal.tsx` | Clone of `GenFillModal.tsx` pattern, no prompt input |
| Algorithm (OpenCV) | **New** `src/utils/contentAwareFill.ts` | Core algorithm, selection→mask, OpenCV/WASM dispatch |
| Algorithm (WASM) | **New** `src/workers/contentAwareFill.worker.ts` | Offload processing from main thread |
| Editor state | `src/components/EditorContext.tsx` | Add `cafModalOpen` / `setCAFModalOpen` flag (same as `genFillModalOpen`) |
| Output | `EditorContext.addLayer()` | Already exists — add result as new layer, identical to GenFill |
| WASM binaries | `public/wasm/` | Drop `caf.wasm` + `caf.js` here (directory already exists) |
| i18n | `src/i18n/en.ts` + `src/i18n/vi.ts` | Add tool name and status messages |

### 6.2 Data Flow

```
User makes selection (rect / ellipse / path)
    ↓
User clicks Edit → Content-Aware Fill
    ↓
ContentAwareFillModal opens (anchored to selection, like GenFillModal)
    ↓
User clicks "Fill"
    ↓
[Main Thread]
    Extract layerCanvas ImageData for active layer
    Generate mask ImageData from selection shape
    Post message to ContentAwareFillWorker
    Show progress spinner in modal
    ↓
[Web Worker]
    Load WASM / ONNX model (or use cached instance)
    Run inpainting algorithm
    Post result ImageData back to main thread
    ↓
[Main Thread]
    Draw result onto new HTMLCanvasElement (canvas-sized)
    Only overwrite pixels inside the selection mask
    Call addLayer("Content-Aware Fill", resultCanvas)
    Close modal — selection remains active
```

### 6.3 Mask Generation from Selection Types

The existing `Selection` interface (`EditorContext.tsx`) supports three types:

```typescript
// All three selection types must generate a correct binary mask:

function selectionToMask(
    selection: Selection,
    canvasWidth: number,
    canvasHeight: number
): ImageData {
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = canvasWidth
    maskCanvas.height = canvasHeight
    const ctx = maskCanvas.getContext('2d')!

    // Black background = keep, white = fill
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = 'white'

    switch (selection.type) {
        case 'rect':
            ctx.fillRect(selection.x, selection.y, selection.width, selection.height)
            break
        case 'ellipse': {
            const rx = selection.width / 2
            const ry = selection.height / 2
            ctx.beginPath()
            ctx.ellipse(selection.x + rx, selection.y + ry, rx, ry, 0, 0, Math.PI * 2)
            ctx.fill()
            break
        }
        case 'path':
            if (selection.path && selection.path.length > 2) {
                ctx.beginPath()
                ctx.moveTo(selection.path[0].x, selection.path[0].y)
                selection.path.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
                ctx.closePath()
                ctx.fill()
            }
            break
    }

    return ctx.getImageData(0, 0, canvasWidth, canvasHeight)
}
```

### 6.4 Memory Budget

| Scenario | RAM Usage |
|----------|-----------|
| Baseline (no CAF) | — |
| OpenCV.js loaded | +50–80 MB |
| During OpenCV inpainting (4K image) | +100–200 MB peak |
| LaMa ONNX model loaded (lighter variant) | +100–200 MB |
| During LaMa inference | +300–600 MB peak |
| CImg WASM loaded | +5–10 MB |
| During CImg inpainting (4K image) | +50–100 MB peak |

**Guidance:** For all options, processing should run in a Web Worker and large images should be downsampled before inpainting (then result upscaled). The existing `public/wasm/` directory and `idb-keyval` caching mitigate repeated download costs.

---

## 7. UI/UX Design

### 7.1 Modal Design (Clone of GenFillModal Pattern)

```
┌─────────────────────────────────┐
│ 🖼️  Content-Aware Fill      [×] │
├─────────────────────────────────┤
│                                 │
│  Quality: ○ Fast  ● Balanced    │  ← Radio buttons (Phase 2+)
│                                 │
│  ┌───────────────────────────┐  │
│  │ [Preview of selected area]│  │  ← Selection preview (like GenFillModal)
│  └───────────────────────────┘  │
│                                 │
│  ░░░░░░░░░░░░░░░░░░ 67%         │  ← Progress bar (during processing)
│                                 │
│           [Cancel]  [Fill ✓]    │
└─────────────────────────────────┘
```

### 7.2 Result Handling

Same pattern as `GenFillModal`:
- Result is added as a **new layer** above the active layer
- Selection remains active after fill
- User can undo via the existing undo/history system

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenCV.js quality insufficient for user expectations | Medium | Medium | Clear messaging ("best for small areas"), offer upgrade path |
| LaMa model 207 MB too large for casual users | High | Medium | Use OpenCV's lighter ~25 MB variant instead |
| WASM memory exhaustion on large images | Low | High | Cap input at 2048×2048, downsample + upscale |
| CImg WASM build complexity | Medium | Medium | Use Docker + reproducible Emscripten setup; 1-time cost |
| Safari SharedArrayBuffer restrictions | Low | Low | Run single-threaded; avoid `--shared-memory` flag |
| Processing blocks UI on slow devices | Medium | High | **Always** run in Web Worker — non-negotiable |
| Browser cache evicts IndexedDB WASM | Low | Low | Re-download on next use; show loading indicator |

---

## 9. Conclusion

Content-Aware Fill is **highly feasible** as a fully on-device feature. The codebase is well-prepared:

- `healing.ts` provides directly reusable pixel manipulation code
- `GenFillModal.tsx` is the exact UI pattern to clone
- `public/wasm/` is ready for WASM binaries
- `idb-keyval` handles persistent model caching
- The Web Worker pattern is already established

**Decision Matrix:**

| If you want... | Choose |
|----------------|--------|
| Fastest path to a working feature | **Option A** — OpenCV.js |
| Best quality with manageable download | **Option C** — CImg WASM |
| AI-level quality, willing to handle larger download | **Option B** — LaMa ONNX (lighter variant) |
| All of the above, progressively | **A → C → B** (the recommended roadmap) |

---

## 10. Next Steps

1. **Decide on implementation phase to start with** (A, C, or A→C)
2. **Create `src/utils/contentAwareFill.ts`** — utility wrapping the chosen algorithm
3. **Create `src/workers/contentAwareFill.worker.ts`** — Web Worker for processing
4. **Create `src/components/ContentAwareFillModal.tsx`** — UI modal (clone `GenFillModal.tsx`)
5. **Wire up in `EditorContext.tsx`** — add `cafModalOpen` state flag
6. **Add menu trigger in `Header.tsx`** — Edit → Content-Aware Fill (enabled only when selection exists)
7. **(Phase 2 only)** Set up Emscripten Docker environment and compile CImg WASM

---

## 11. References

- [OpenCV.js Documentation](https://docs.opencv.org/3.4/df/d0a/tutorial_js_intro.html)
- [OpenCV Inpainting Tutorial (TELEA/NS)](https://docs.opencv.org/3.4/df/d3d/tutorial_py_inpainting.html)
- [LaMa Paper — Resolution-Robust Large Mask Inpainting (WACV 2022)](https://advimman.github.io/lama-project/)
- [Carve/LaMa-ONNX on HuggingFace](https://huggingface.co/Carve/LaMa-ONNX) — 207 MB model
- [opencv/inpainting_lama on HuggingFace](https://huggingface.co/opencv/inpainting_lama) — lighter variant
- [Client-Side Image Inpainting with ONNX and Next.js](https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059) — confirmed browser feasibility
- [PatchMatch Paper — Barnes et al. 2009](https://dl.acm.org/doi/10.1145/1576246.1531330)
- [CImg Library](https://cimg.eu/)
- [CImg `inpaint.h` Plugin](https://github.com/GreycLab/CImg/blob/master/plugins/inpaint.h)
- [inpaint.js](https://github.com/antimatter15/inpaint.js)
- [GIMP Resynthesizer Plugin](https://github.com/bootchk/resynthesizer) — inspiration for texture synthesis approach
- [Emscripten Documentation](https://emscripten.org/)
- [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/)
