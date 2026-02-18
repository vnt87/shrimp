/**
 * Type declaration for the Emscripten-generated WASM glue module (caf.js).
 *
 * TypeScript cannot introspect the auto-generated Emscripten JS file, so we
 * declare it as a module here.  The actual runtime shape is defined by the
 * EMSCRIPTEN_BINDINGS block in src/wasm/caf_wrapper.cpp.
 */

/** The live instance returned after the WASM module initialises. */
export interface CAFModuleInstance {
    /**
     * Run PatchMatch inpainting in-place on the RGBA image buffer.
     *
     * @param imgPtr    Offset into the WASM heap — RGBA image (width*height*4 bytes)
     * @param maskPtr   Offset into the WASM heap — RGBA mask  (width*height*4 bytes)
     * @param width     Image width in pixels
     * @param height    Image height in pixels
     * @param patchSize Patch radius (7–11 recommended)
     * @param lookupSize Search area multiplier (default 22)
     */
    inpaintImage(
        imgPtr: number,
        maskPtr: number,
        width: number,
        height: number,
        patchSize: number,
        lookupSize: number
    ): void

    /** Returns the byte count needed for a width×height RGBA buffer. */
    getBufferSize(width: number, height: number): number

    /** Allocate nbytes on the WASM heap; returns a byte offset. */
    _malloc(nbytes: number): number

    /** Free a previously _malloc'd heap region. */
    _free(ptr: number): void

    /** Raw access to the WASM linear memory (Uint8Array view). */
    HEAPU8: Uint8Array
}

/** The factory function that is the default export of the Emscripten glue JS. */
declare function createCAFModule(): Promise<CAFModuleInstance>

declare module '/wasm/caf.js' {
    export default createCAFModule
}
