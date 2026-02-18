/**
 * Content-Aware Fill WASM Wrapper
 *
 * Bridges CImg's PatchMatch inpainting algorithm to JavaScript/TypeScript.
 * Compiled with Emscripten to produce caf.js + caf.wasm in public/wasm/.
 *
 * Algorithm: CImg inpaint() — based on PatchMatch (Barnes et al., 2009).
 * The same algorithm family as Photoshop's Content-Aware Fill.
 *
 * Build:
 *   cd src/wasm && ./build.sh
 *   Outputs: ../../public/wasm/caf.js and ../../public/wasm/caf.wasm
 */

// Disable X11/win32 display support (uses #if cimg_display!=0, so 0 works here)
#define cimg_display 0

// NOTE: cimg_use_png / cimg_use_jpeg / cimg_use_tiff / cimg_use_zlib are
// guarded with #ifdef, NOT #if != 0.  Simply leaving them UNDEFINED (the
// default) disables the feature.  Defining them to 0 would still trigger
// the #ifdef and try to include png.h / jpeglib.h etc., which aren't
// available in the Emscripten sysroot.

// inpaint.h is a CImg plugin — it must be injected *inside* the CImg<T>
// struct body via the cimg_plugin mechanism, not included standalone.
// The build script passes -I$(SCRIPT_DIR) so the plugin is found by path.
#define cimg_plugin "inpaint.h"

#include "CImg.h"

#include <emscripten/bind.h>
#include <cstdint>
#include <cstring>
#include <vector>
#include <algorithm>

using namespace cimg_library;

/**
 * Clamps an integer value to [0, 255].
 */
static inline uint8_t clamp8(int v) {
    return static_cast<uint8_t>(std::max(0, std::min(255, v)));
}

/**
 * inpaintImage — main entry point exposed to JavaScript.
 *
 * Receives raw RGBA pixel data (interleaved, row-major) for both the source
 * image and the binary fill mask.  Runs CImg PatchMatch inpainting in-place
 * on the image pointer, then returns the result back to JS as a JS Uint8Array.
 *
 * @param imgPtr    Pointer into WASM heap — RGBA image bytes, width*height*4
 * @param maskPtr   Pointer into WASM heap — RGBA mask bytes (white = fill area)
 * @param width     Image width in pixels
 * @param height    Image height in pixels
 * @param patchSize Patch radius for texture synthesis (recommended 7–11)
 * @param iterations Number of PatchMatch passes (recommended 3–5; more = better quality, slower)
 */
void inpaintImage(
    uintptr_t imgPtr,
    uintptr_t maskPtr,
    int width,
    int height,
    int patchSize,
    int iterations
) {
    // Reinterpret WASM heap pointers
    const auto* imgData  = reinterpret_cast<const uint8_t*>(imgPtr);
    const auto* maskData = reinterpret_cast<const uint8_t*>(maskPtr);

    // -----------------------------------------------------------------------
    // Convert interleaved RGBA  →  CImg planar RGB (3 channels)
    // CImg stores data as  [ R plane | G plane | B plane ]
    // -----------------------------------------------------------------------
    CImg<uint8_t> img(width, height, 1, 3);  // 3-channel RGB
    CImg<uint8_t> mask(width, height, 1, 1); // 1-channel grayscale mask

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const int srcIdx = (y * width + x) * 4;
            img(x, y, 0, 0) = imgData[srcIdx];       // R
            img(x, y, 0, 1) = imgData[srcIdx + 1];   // G
            img(x, y, 0, 2) = imgData[srcIdx + 2];   // B
            // Alpha channel (srcIdx+3) is ignored for fill; restored after

            // Mask: treat any pixel where R > 128 as "fill this pixel"
            mask(x, y, 0, 0) = (maskData[srcIdx] > 128) ? 255 : 0;
        }
    }

    // -----------------------------------------------------------------------
    // Run PatchMatch inpainting via the inpaint.h plugin (modifies img in-place)
    // inpaint_patch(mask, patch_size, nb_iters, blend, method)
    // method=0 = best quality (nearest-neighbour synthesis)
    // -----------------------------------------------------------------------
    img.inpaint_patch(mask, static_cast<unsigned>(patchSize), static_cast<unsigned>(iterations));

    // -----------------------------------------------------------------------
    // Write result back to the WASM heap (interleaved RGBA, preserve alpha)
    // -----------------------------------------------------------------------
    auto* outData = reinterpret_cast<uint8_t*>(imgPtr);
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const int dstIdx = (y * width + x) * 4;
            outData[dstIdx]     = clamp8(img(x, y, 0, 0)); // R
            outData[dstIdx + 1] = clamp8(img(x, y, 0, 1)); // G
            outData[dstIdx + 2] = clamp8(img(x, y, 0, 2)); // B
            // Alpha channel left unchanged (already in heap from the input)
        }
    }
}

/**
 * Returns the byte length needed for a single RGBA image buffer.
 * Used by JS to allocate the correct amount of WASM heap memory.
 */
int getBufferSize(int width, int height) {
    return width * height * 4;
}

// ---------------------------------------------------------------------------
// Emscripten bindings — expose functions to JavaScript
// ---------------------------------------------------------------------------
EMSCRIPTEN_BINDINGS(caf_module) {
    emscripten::function("inpaintImage", &inpaintImage);
    emscripten::function("getBufferSize", &getBufferSize);
}
