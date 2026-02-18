# Content-Aware Fill Implementation Plan (CImg WASM)

## Overview

This plan details the implementation of Content-Aware Fill using the CImg library compiled to WebAssembly. This approach provides Photoshop-quality texture synthesis with a small download footprint (~1-3MB).

---

## Phase 1: WASM Module Development

### 1.1 Set Up Build Environment

**Prerequisites:**
- Emscripten SDK (emsdk)
- CMake (optional, for more complex builds)

**Installation:**
```bash
# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### 1.2 Create WASM Module Structure

**Directory Structure:**
```
src/wasm/
  CImg.h                 # CImg header (downloaded)
  inpaint.h              # Inpaint plugin (downloaded)
  patchmatch_wrapper.cpp # Our wrapper code
  build.sh               # Build script
```

### 1.3 Download CImg and Inpaint Plugin

```bash
# Download CImg header
wget https://github.com/GreycLab/CImg/raw/master/CImg.h -O src/wasm/CImg.h

# Download inpaint plugin
wget https://github.com/GreycLab/CImg/raw/master/plugins/inpaint.h -O src/wasm/inpaint.h
```

### 1.4 Create C++ Wrapper

**File: [`src/wasm/patchmatch_wrapper.cpp`](src/wasm/patchmatch_wrapper.cpp)**

```cpp
#define cimg_display 0      // No display support
#define cimg_use_png 0      // No PNG support (we handle raw pixels)
#define cimg_use_jpeg 0     // No JPEG support
#define cimg_use_zlib 0     // No zlib

#include "CImg.h"
#include "plugins/inpaint.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>
#include <cstdint>

using namespace cimg_library;

/**
 * Inpainting function exposed to JavaScript
 * 
 * @param img_data Pointer to image pixel data (RGBA)
 * @param mask_data Pointer to mask data (grayscale, 255 = inpaint area)
 * @param width Image width
 * @param height Image height
 * @param patch_size Patch size for PatchMatch (default 7)
 * @param iterations Number of iterations (default 5)
 * @return Pointer to result image data
 */
std::vector<uint8_t> inpaint(
    const emscripten::val& img_data,
    const emscripten::val& mask_data,
    int width,
    int height,
    int patch_size = 7,
    int iterations = 5
) {
    // Convert JavaScript typed arrays to C++ vectors
    std::vector<uint8_t> img_vec = emscripten::convertJSArrayToNumberVector<uint8_t>(img_data);
    std::vector<uint8_t> mask_vec = emscripten::convertJSArrayToNumberVector<uint8_t>(mask_data);
    
    // Create CImg objects
    // Image: RGBA format, so 4 channels
    CImg<uint8_t> img(img_vec.data(), width, height, 1, 4, true);
    // Mask: Single channel
    CImg<uint8_t> mask(mask_vec.data(), width, height, 1, 1, true);
    
    // Create output image (copy of input)
    CImg<uint8_t> result(img);
    
    // Run PatchMatch inpainting
    // The mask should have 255 for pixels to inpaint
    result.inpaint(mask, patch_size, iterations);
    
    // Convert back to vector
    std::vector<uint8_t> output(result.size());
    std::memcpy(output.data(), result.data(), result.size());
    
    return output;
}

/**
 * Get the size of the output buffer needed
 */
int get_output_size(int width, int height) {
    return width * height * 4; // RGBA
}

EMSCRIPTEN_BINDINGS(patchmatch_module) {
    emscripten::function("inpaint", &inpaint);
    emscripten::function("get_output_size", &get_output_size);
    
    // Register vector type for return value
    emscripten::register_vector<uint8_t>("Uint8Vector");
}
```

### 1.5 Create Build Script

**File: [`src/wasm/build.sh`](src/wasm/build.sh)**

```bash
#!/bin/bash

# Activate Emscripten (adjust path as needed)
source ~/emsdk/emsdk_env.sh 2>/dev/null || true

# Build with Emscripten
emcc patchmatch_wrapper.cpp \
    -o patchmatch.js \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="PatchMatchModule" \
    -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','convertJSArrayToNumberVector']" \
    -s "EXPORTED_FUNCTIONS=['_malloc','_free']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=268435456 \
    --bind \
    -s SINGLE_FILE=0

echo "Build complete: patchmatch.js and patchmatch.wasm"
ls -la patchmatch.*
```

### 1.6 Build the WASM Module

```bash
cd src/wasm
chmod +x build.sh
./build.sh
```

**Expected Output:**
- `patchmatch.js` - JavaScript glue code (~50KB)
- `patchmatch.wasm` - WebAssembly binary (~1-3MB)

---

## Phase 2: TypeScript Integration

### 2.1 Create TypeScript Module

**File: [`src/utils/patchmatch.ts`](src/utils/patchmatch.ts)**

```typescript
/**
 * PatchMatch Content-Aware Fill using CImg WASM
 */

// Type definitions for the WASM module
interface PatchMatchModule {
    inpaint(
        imageData: Uint8Array,
        maskData: Uint8Array,
        width: number,
        height: number,
        patchSize: number,
        iterations: number
    ): Uint8Array;
    get_output_size(width: number, height: number): number;
}

// Module loading promise
let wasmModule: PatchMatchModule | null = null;
let wasmLoadingPromise: Promise<PatchMatchModule> | null = null;

/**
 * Load the PatchMatch WASM module
 * Returns a promise that resolves when the module is ready
 */
export async function loadPatchMatch(): Promise<PatchMatchModule> {
    if (wasmModule) {
        return wasmModule;
    }
    
    if (wasmLoadingPromise) {
        return wasmLoadingPromise;
    }
    
    wasmLoadingPromise = (async () => {
        // Dynamic import of the WASM module
        const { default: createModule } = await import('../../public/wasm/patchmatch.js');
        
        // Initialize the module
        const module = await createModule();
        wasmModule = module;
        return module;
    })();
    
    return wasmLoadingPromise;
}

/**
 * Check if PatchMatch is loaded and ready
 */
export function isPatchMatchReady(): boolean {
    return wasmModule !== null;
}

/**
 * Content-Aware Fill options
 */
export interface ContentAwareFillOptions {
    /** Patch size for texture synthesis (default: 7) */
    patchSize?: number;
    /** Number of PatchMatch iterations (default: 5) */
    iterations?: number;
    /** Callback for progress updates */
    onProgress?: (progress: number) => void;
}

/**
 * Apply content-aware fill to an image region
 * 
 * @param imageData - Source image data (RGBA)
 * @param mask - Mask where 255 = pixels to fill, 0 = keep original
 * @param options - Fill options
 * @returns Promise resolving to filled image data
 */
export async function contentAwareFill(
    imageData: ImageData,
    mask: ImageData,
    options: ContentAwareFillOptions = {}
): Promise<ImageData> {
    const {
        patchSize = 7,
        iterations = 5,
        onProgress
    } = options;
    
    // Ensure module is loaded
    const pm = await loadPatchMatch();
    
    // Report progress
    onProgress?.(0.1);
    
    // Convert ImageData to Uint8Arrays
    const imgArray = new Uint8Array(imageData.data.buffer);
    
    // Convert mask to grayscale if needed
    const maskArray = maskToGrayscale(mask);
    
    onProgress?.(0.2);
    
    // Run inpainting
    const result = pm.inpaint(
        imgArray,
        maskArray,
        imageData.width,
        imageData.height,
        patchSize,
        iterations
    );
    
    onProgress?.(0.9);
    
    // Create result ImageData
    const outputData = new ImageData(
        new Uint8ClampedArray(result.buffer),
        imageData.width,
        imageData.height
    );
    
    onProgress?.(1.0);
    
    return outputData;
}

/**
 * Convert mask ImageData to grayscale Uint8Array
 */
function maskToGrayscale(mask: ImageData): Uint8Array {
    const result = new Uint8Array(mask.width * mask.height);
    const data = mask.data;
    
    for (let i = 0; i < result.length; i++) {
        const idx = i * 4;
        // Use alpha channel if available, otherwise use luminance
        if (data[idx + 3] > 0) {
            // Use alpha channel
            result[i] = data[idx + 3];
        } else {
            // Calculate luminance
            result[i] = Math.round(
                0.299 * data[idx] +
                0.587 * data[idx + 1] +
                0.114 * data[idx + 2]
            );
        }
    }
    
    return result;
}

/**
 * Create a mask from a selection
 * 
 * @param selection - Selection object
 * @param canvasSize - Canvas dimensions
 * @returns ImageData containing the mask
 */
export function createMaskFromSelection(
    selection: { x: number; y: number; width: number; height: number; type: string; path?: { x: number; y: number }[] },
    canvasSize: { width: number; height: number }
): ImageData {
    const mask = new ImageData(canvasSize.width, canvasSize.height);
    const data = mask.data;
    
    if (selection.type === 'ellipse') {
        // Ellipse selection
        const cx = selection.x + selection.width / 2;
        const cy = selection.y + selection.height / 2;
        const rx = selection.width / 2;
        const ry = selection.height / 2;
        
        for (let y = 0; y < canvasSize.height; y++) {
            for (let x = 0; x < canvasSize.width; x++) {
                const dx = (x - cx) / rx;
                const dy = (y - cy) / ry;
                if (dx * dx + dy * dy <= 1) {
                    const idx = (y * canvasSize.width + x) * 4;
                    data[idx + 3] = 255; // Alpha = 255 (fill this pixel)
                }
            }
        }
    } else if (selection.type === 'path' && selection.path && selection.path.length > 2) {
        // Lasso/path selection - use scanline fill
        const path = selection.path;
        const minY = Math.min(...path.map(p => p.y));
        const maxY = Math.max(...path.map(p => p.y));
        
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            const intersections: number[] = [];
            
            // Find intersections with path edges
            for (let i = 0; i < path.length; i++) {
                const p1 = path[i];
                const p2 = path[(i + 1) % path.length];
                
                if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                    const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
                    intersections.push(x);
                }
            }
            
            // Sort intersections
            intersections.sort((a, b) => a - b);
            
            // Fill between pairs
            for (let i = 0; i < intersections.length - 1; i += 2) {
                const x1 = Math.max(0, Math.floor(intersections[i]));
                const x2 = Math.min(canvasSize.width - 1, Math.ceil(intersections[i + 1]));
                
                for (let x = x1; x <= x2; x++) {
                    const idx = (y * canvasSize.width + x) * 4;
                    data[idx + 3] = 255;
                }
            }
        }
    } else {
        // Rectangle selection (default)
        for (let y = selection.y; y < selection.y + selection.height; y++) {
            for (let x = selection.x; x < selection.x + selection.width; x++) {
                if (x >= 0 && x < canvasSize.width && y >= 0 && y < canvasSize.height) {
                    const idx = (y * canvasSize.width + x) * 4;
                    data[idx + 3] = 255;
                }
            }
        }
    }
    
    return mask;
}
```

### 2.2 Create Web Worker for Background Processing

**File: [`src/workers/patchmatch.worker.ts`](src/workers/patchmatch.worker.ts)**

```typescript
/**
 * Web Worker for PatchMatch Content-Aware Fill
 * Runs inpainting in a background thread to avoid UI blocking
 */

import { contentAwareFill, loadPatchMatch, ContentAwareFillOptions } from '../utils/patchmatch';

// Message types
interface FillRequestMessage {
    type: 'fill';
    id: string;
    imageData: ImageData;
    mask: ImageData;
    options: ContentAwareFillOptions;
}

interface InitMessage {
    type: 'init';
}

type WorkerMessage = FillRequestMessage | InitMessage;

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type } = event.data;
    
    switch (type) {
        case 'init':
            try {
                await loadPatchMatch();
                self.postMessage({ type: 'ready' });
            } catch (error) {
                self.postMessage({ 
                    type: 'error', 
                    error: error instanceof Error ? error.message : 'Failed to load WASM' 
                });
            }
            break;
            
        case 'fill':
            try {
                const { id, imageData, mask, options } = event.data;
                
                const result = await contentAwareFill(imageData, mask, {
                    ...options,
                    onProgress: (progress) => {
                        self.postMessage({ type: 'progress', id, progress });
                    }
                });
                
                self.postMessage({ 
                    type: 'result', 
                    id, 
                    imageData: result 
                }, [result.data.buffer]);
            } catch (error) {
                self.postMessage({ 
                    type: 'error', 
                    id: event.data.id,
                    error: error instanceof Error ? error.message : 'Fill failed' 
                });
            }
            break;
    }
};

export {};
```

---

## Phase 3: UI Integration

### 3.1 Add Content-Aware Fill to Editor Context

**Changes to [`src/components/EditorContext.tsx`](src/components/EditorContext.tsx):**

```typescript
// Add to EditorContextType interface
interface EditorContextType {
    // ... existing properties
    contentAwareFill: () => Promise<void>;
    isContentAwareFillLoading: boolean;
}

// Add state
const [isContentAwareFillLoading, setIsContentAwareFillLoading] = useState(false);

// Add function
const contentAwareFill = useCallback(async () => {
    if (!selection || !activeLayer) return;
    
    setIsContentAwareFillLoading(true);
    
    try {
        // Get image data from active layer
        const layerCanvas = getLayerCanvas(activeLayer.id);
        const ctx = layerCanvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
        
        // Create mask from selection
        const mask = createMaskFromSelection(selection, canvasSize);
        
        // Run content-aware fill
        const result = await contentAwareFillWorker(imageData, mask);
        
        // Apply result to layer
        ctx.putImageData(result, 0, 0);
        updateLayerData(activeLayer.id, layerCanvas);
        
        // Clear selection
        setSelection(null);
    } catch (error) {
        console.error('Content-aware fill failed:', error);
    } finally {
        setIsContentAwareFillLoading(false);
    }
}, [selection, activeLayer, canvasSize, getLayerCanvas, updateLayerData]);
```

### 3.2 Add Menu Item

**Changes to [`src/components/Header.tsx`](src/components/Header.tsx):**

Add "Content-Aware Fill" menu item under Edit menu:

```tsx
// In Edit menu dropdown
<MenuItem 
    onClick={handleContentAwareFill}
    disabled={!selection || isContentAwareFillLoading}
    icon={<Wand2 size={14} />}
>
    {isContentAwareFillLoading ? 'Processing...' : 'Content-Aware Fill'}
    <span style={{ marginLeft: 'auto', opacity: 0.5 }}>Shift+Del</span>
</MenuItem>
```

### 3.3 Add Keyboard Shortcut

**Changes to [`src/App.tsx`](src/App.tsx):**

```typescript
// Add keyboard shortcut handler
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // ... existing shortcuts
        
        // Content-Aware Fill: Shift+Delete
        if (e.shiftKey && e.key === 'Delete' && selection) {
            e.preventDefault();
            contentAwareFill();
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [selection, contentAwareFill]);
```

### 3.4 Add Progress Modal

**File: [`src/components/ContentAwareFillModal.tsx`](src/components/ContentAwareFillModal.tsx)**

```tsx
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ContentAwareFillModalProps {
    isOpen: boolean;
    progress: number;
}

export default function ContentAwareFillModal({ isOpen, progress }: ContentAwareFillModalProps) {
    if (!isOpen) return null;
    
    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-main)',
            borderRadius: 8,
            padding: 24,
            zIndex: 10000,
            minWidth: 280,
            textAlign: 'center',
        }}>
            <Loader2 
                size={32} 
                style={{ 
                    animation: 'spin 1s linear infinite',
                    marginBottom: 16,
                    color: 'var(--accent-active)',
                }} 
            />
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>
                Content-Aware Fill
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                Analyzing image and synthesizing content...
            </p>
            <div style={{
                width: '100%',
                height: 4,
                background: 'var(--bg-2)',
                borderRadius: 2,
                overflow: 'hidden',
            }}>
                <div style={{
                    width: `${progress * 100}%`,
                    height: '100%',
                    background: 'var(--accent-active)',
                    transition: 'width 0.2s ease',
                }} />
            </div>
        </div>
    );
}
```

---

## Phase 4: Testing

### 4.1 Unit Tests

**File: [`src/utils/__tests__/patchmatch.test.ts`](src/utils/__tests__/patchmatch.test.ts)**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { loadPatchMatch, contentAwareFill, createMaskFromSelection } from '../patchmatch';

describe('PatchMatch Module', () => {
    beforeAll(async () => {
        await loadPatchMatch();
    });
    
    it('should load WASM module successfully', () => {
        expect(loadPatchMatch()).resolves.toBeDefined();
    });
    
    it('should fill a small masked region', async () => {
        // Create a simple 10x10 image with a white square in center
        const imageData = new ImageData(10, 10);
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 200;     // R
            imageData.data[i + 1] = 200; // G
            imageData.data[i + 2] = 200; // B
            imageData.data[i + 3] = 255; // A
        }
        
        // Create mask for center 4x4 region
        const mask = new ImageData(10, 10);
        for (let y = 3; y < 7; y++) {
            for (let x = 3; x < 7; x++) {
                const idx = (y * 10 + x) * 4;
                mask.data[idx + 3] = 255; // Mark for filling
            }
        }
        
        const result = await contentAwareFill(imageData, mask);
        
        // Result should have same dimensions
        expect(result.width).toBe(10);
        expect(result.height).toBe(10);
        
        // Filled region should have similar color to surroundings
        const centerIdx = (5 * 10 + 5) * 4;
        expect(result.data[centerIdx]).toBeGreaterThan(150);
        expect(result.data[centerIdx]).toBeLessThan(250);
    });
    
    it('should create correct mask from rectangle selection', () => {
        const selection = { x: 2, y: 2, width: 4, height: 4, type: 'rect' };
        const canvasSize = { width: 10, height: 10 };
        
        const mask = createMaskFromSelection(selection, canvasSize);
        
        // Check that pixels inside selection are marked
        const insideIdx = (4 * 10 + 4) * 4 + 3;
        expect(mask.data[insideIdx]).toBe(255);
        
        // Check that pixels outside selection are not marked
        const outsideIdx = (0 * 10 + 0) * 4 + 3;
        expect(mask.data[outsideIdx]).toBe(0);
    });
});
```

### 4.2 Integration Test

```typescript
describe('Content-Aware Fill Integration', () => {
    it('should be accessible from Edit menu when selection exists', () => {
        // Test that menu item is enabled when selection exists
    });
    
    it('should show progress modal during processing', () => {
        // Test that progress modal appears
    });
    
    it('should apply result to active layer', () => {
        // Test that layer is updated after fill
    });
});
```

---

## Phase 5: Documentation

### 5.1 Update README

Add section about Content-Aware Fill feature:

```markdown
## Content-Aware Fill

SHRIMP includes a Content-Aware Fill feature that automatically synthesizes 
image content to fill selected regions. This is powered by the PatchMatch 
algorithm compiled to WebAssembly.

### Usage

1. Make a selection using any selection tool
2. Go to Edit > Content-Aware Fill (or press Shift+Delete)
3. Wait for processing to complete
4. The selection will be filled with synthesized content

### Technical Details

- Algorithm: PatchMatch texture synthesis
- Implementation: CImg library compiled to WebAssembly
- Download size: ~1-3MB (loaded on first use)
- Processing: Runs in Web Worker to avoid UI blocking
```

### 5.2 Add i18n Translations

**Changes to [`src/i18n/en.ts`](src/i18n/en.ts):**

```typescript
export const en = {
    // ... existing translations
    'menu.content_aware_fill': 'Content-Aware Fill',
    'content_aware_fill.processing': 'Processing...',
    'content_aware_fill.title': 'Content-Aware Fill',
    'content_aware_fill.description': 'Analyzing image and synthesizing content...',
};
```

**Changes to [`src/i18n/vi.ts`](src/i18n/vi.ts):**

```typescript
export const vi = {
    // ... existing translations
    'menu.content_aware_fill': 'Tô Màu Thông Minh',
    'content_aware_fill.processing': 'Ðang x? lý...',
    'content_aware_fill.title': 'Tô Màu Thông Minh',
    'content_aware_fill.description': 'Phân tích hình ?nh và t?o n?i dung m?i...',
};
```

---

## Implementation Checklist

### Phase 1: WASM Module
- [ ] Install Emscripten SDK
- [ ] Download CImg.h and inpaint.h
- [ ] Create patchmatch_wrapper.cpp
- [ ] Create build.sh script
- [ ] Build WASM module
- [ ] Test WASM module in isolation

### Phase 2: TypeScript Integration
- [ ] Create src/utils/patchmatch.ts
- [ ] Create src/workers/patchmatch.worker.ts
- [ ] Add WASM files to public/wasm/
- [ ] Configure Vite to serve WASM files

### Phase 3: UI Integration
- [ ] Add contentAwareFill to EditorContext
- [ ] Add menu item to Header
- [ ] Add keyboard shortcut
- [ ] Create ContentAwareFillModal component
- [ ] Add progress indicator

### Phase 4: Testing
- [ ] Write unit tests for patchmatch.ts
- [ ] Write integration tests
- [ ] Test with various selection types
- [ ] Test with large images
- [ ] Test memory usage

### Phase 5: Documentation
- [ ] Update README.md
- [ ] Add i18n translations
- [ ] Add inline code comments

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WASM build fails | Test build early, have OpenCV.js as fallback |
| Memory issues with large images | Limit selection size, use Web Worker |
| Quality not as expected | Tune patch size and iterations |
| Slow processing | Show progress, allow cancellation |

---

## Estimated Effort

| Phase | Tasks |
|-------|-------|
| Phase 1: WASM Module | Build environment setup, wrapper code, compilation |
| Phase 2: TypeScript | Module loading, worker setup, utility functions |
| Phase 3: UI | Menu integration, progress modal, keyboard shortcuts |
| Phase 4: Testing | Unit tests, integration tests, manual testing |
| Phase 5: Documentation | README, i18n, code comments |

---

## Success Criteria

1. Content-Aware Fill accessible from Edit menu
2. Works with all selection types (rect, ellipse, lasso)
3. Processing completes in reasonable time (<10s for typical selections)
4. Results are visually acceptable
5. No UI blocking during processing
6. Works offline (no external API calls)