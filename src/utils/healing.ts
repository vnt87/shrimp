/**
 * Healing Brush Algorithm - Frequency-Based Healing
 * 
 * This implements a frequency-based healing approach similar to Photoshop's Healing Brush:
 * 1. Decompose source and destination into high/low frequency components
 * 2. Copy high-frequency (texture) from source
 * 3. Adapt low-frequency (color/luminance) to match destination
 * 4. Recombine and blend
 */

/**
 * Configuration for healing operation
 */
export interface HealConfig {
    /** Strength of healing (0-1), affects how much texture is preserved vs color adaptation */
    strength: number
    /** Radius for Gaussian blur (low-pass filter) - larger = more smoothing */
    blurRadius: number
}

/**
 * Extract a patch of pixels from source image data
 */
function extractPatch(
    source: ImageData,
    sourceWidth: number,
    sourceHeight: number,
    centerX: number,
    centerY: number,
    patchSize: number
): ImageData {
    const halfSize = Math.floor(patchSize / 2)
    const patch = new ImageData(patchSize, patchSize)
    
    for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
            const sx = Math.round(centerX - halfSize + px)
            const sy = Math.round(centerY - halfSize + py)
            
            const patchIdx = (py * patchSize + px) * 4
            
            if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
                const srcIdx = (sy * sourceWidth + sx) * 4
                patch.data[patchIdx] = source.data[srcIdx]
                patch.data[patchIdx + 1] = source.data[srcIdx + 1]
                patch.data[patchIdx + 2] = source.data[srcIdx + 2]
                patch.data[patchIdx + 3] = source.data[srcIdx + 3]
            } else {
                // Out of bounds - use transparent black
                patch.data[patchIdx] = 0
                patch.data[patchIdx + 1] = 0
                patch.data[patchIdx + 2] = 0
                patch.data[patchIdx + 3] = 0
            }
        }
    }
    
    return patch
}

/**
 * Apply Gaussian blur to an ImageData (simple box blur approximation for performance)
 */
function gaussianBlur(imageData: ImageData, radius: number): ImageData {
    if (radius <= 0) return imageData
    
    const { width, height, data } = imageData
    const result = new ImageData(width, height)
    const temp = new Uint8ClampedArray(data.length)
    
    // Horizontal pass
    const kernelSize = radius * 2 + 1
    const kernel = 1 / kernelSize
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0
            
            for (let k = -radius; k <= radius; k++) {
                const sx = Math.min(Math.max(x + k, 0), width - 1)
                const idx = (y * width + sx) * 4
                r += data[idx]
                g += data[idx + 1]
                b += data[idx + 2]
                a += data[idx + 3]
            }
            
            const idx = (y * width + x) * 4
            temp[idx] = r * kernel
            temp[idx + 1] = g * kernel
            temp[idx + 2] = b * kernel
            temp[idx + 3] = a * kernel
        }
    }
    
    // Vertical pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0
            
            for (let k = -radius; k <= radius; k++) {
                const sy = Math.min(Math.max(y + k, 0), height - 1)
                const idx = (sy * width + x) * 4
                r += temp[idx]
                g += temp[idx + 1]
                b += temp[idx + 2]
                a += temp[idx + 3]
            }
            
            const idx = (y * width + x) * 4
            result.data[idx] = r * kernel
            result.data[idx + 1] = g * kernel
            result.data[idx + 2] = b * kernel
            result.data[idx + 3] = a * kernel
        }
    }
    
    return result
}

/**
 * Calculate the mean luminance of an ImageData patch
 */
function calculateMeanLuminance(imageData: ImageData): { l: number; a: number; b: number } {
    let totalL = 0, totalA = 0, totalB = 0, count = 0
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i] / 255
        const g = imageData.data[i + 1] / 255
        const b = imageData.data[i + 2] / 255
        const a = imageData.data[i + 3] / 255
        
        if (a > 0.1) { // Only consider non-transparent pixels
            // Convert to Lab-like color space for better luminance estimation
            const l = 0.299 * r + 0.587 * g + 0.114 * b
            totalL += l
            totalA += (r - g) * 0.5 + 0.5
            totalB += (r + g) * 0.25 - b * 0.5 + 0.5
            count++
        }
    }
    
    if (count === 0) return { l: 0.5, a: 0.5, b: 0.5 }
    
    return {
        l: totalL / count,
        a: totalA / count,
        b: totalB / count
    }
}

/**
 * Adjust the luminance/color of a source patch to match destination
 */
function adaptLuminance(
    sourceHighFreq: ImageData,
    sourceLowFreq: ImageData,
    destLowFreq: ImageData,
    strength: number
): ImageData {
    const result = new ImageData(sourceHighFreq.width, sourceHighFreq.height)
    
    const sourceMean = calculateMeanLuminance(sourceLowFreq)
    const destMean = calculateMeanLuminance(destLowFreq)
    
    // Calculate adaptation factors (only luminance factor used for simplicity)
    const lFactor = sourceMean.l > 0.01 ? destMean.l / sourceMean.l : 1
    // aFactor and bFactor reserved for future color-aware healing
    // const aFactor = sourceMean.a > 0.01 ? destMean.a / sourceMean.a : 1
    // const bFactor = sourceMean.b > 0.01 ? destMean.b / sourceMean.b : 1
    
    // Blend factor based on strength
    const blendFactor = strength
    
    for (let i = 0; i < result.data.length; i += 4) {
        const srcR = sourceLowFreq.data[i]
        const srcG = sourceLowFreq.data[i + 1]
        const srcB = sourceLowFreq.data[i + 2]
        const srcA = sourceLowFreq.data[i + 3]
        
        const highR = sourceHighFreq.data[i]
        const highG = sourceHighFreq.data[i + 1]
        const highB = sourceHighFreq.data[i + 2]
        
        const destR = destLowFreq.data[i]
        const destG = destLowFreq.data[i + 1]
        const destB = destLowFreq.data[i + 2]
        
        // Apply luminance adaptation to low frequency
        const adaptedLowR = srcR * lFactor * blendFactor + destR * (1 - blendFactor)
        const adaptedLowG = srcG * lFactor * blendFactor + destG * (1 - blendFactor)
        const adaptedLowB = srcB * lFactor * blendFactor + destB * (1 - blendFactor)
        
        // Combine adapted low frequency with high frequency (texture)
        result.data[i] = Math.min(255, Math.max(0, adaptedLowR + highR - 128))
        result.data[i + 1] = Math.min(255, Math.max(0, adaptedLowG + highG - 128))
        result.data[i + 2] = Math.min(255, Math.max(0, adaptedLowB + highB - 128))
        result.data[i + 3] = srcA
    }
    
    return result
}

/**
 * Create a circular mask for the brush
 */
function createCircularMask(size: number, hardness: number): Float32Array {
    const mask = new Float32Array(size * size)
    const center = size / 2
    const radius = size / 2
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - center + 0.5
            const dy = y - center + 0.5
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            let alpha = 1
            if (dist > radius) {
                alpha = 0
            } else if (hardness < 1) {
                // Soft edge
                const softEdge = radius * (1 - hardness)
                if (dist > radius - softEdge) {
                    alpha = 1 - (dist - (radius - softEdge)) / softEdge
                }
            }
            
            mask[y * size + x] = alpha
        }
    }
    
    return mask
}

/**
 * Main healing function - heals a single brush dab
 * 
 * @param sourceCanvas - Canvas containing source pixels (sampled area)
 * @param destCanvas - Canvas containing destination pixels (where we're painting)
 * @param sourceX - X coordinate in source canvas
 * @param sourceY - Y coordinate in source canvas
 * @param destX - X coordinate in destination canvas
 * @param destY - Y coordinate in destination canvas
 * @param brushSize - Size of the brush in pixels
 * @param config - Healing configuration
 * @returns Healed pixels as ImageData, ready to composite onto destination
 */
export function healBrushDab(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    destCanvas: HTMLCanvasElement | OffscreenCanvas,
    sourceX: number,
    sourceY: number,
    destX: number,
    destY: number,
    brushSize: number,
    config: HealConfig
): ImageData {
    // Ensure odd patch size for centering
    const patchSize = Math.max(3, brushSize % 2 === 0 ? brushSize + 1 : brushSize)
    
    // Get contexts and extract image data
    const srcCtx = sourceCanvas.getContext('2d')!
    const destCtx = destCanvas.getContext('2d')!
    
    const srcImageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
    const destImageData = destCtx.getImageData(0, 0, destCanvas.width, destCanvas.height)
    
    // Extract patches
    const sourcePatch = extractPatch(
        srcImageData,
        sourceCanvas.width,
        sourceCanvas.height,
        sourceX,
        sourceY,
        patchSize
    )
    
    const destPatch = extractPatch(
        destImageData,
        destCanvas.width,
        destCanvas.height,
        destX,
        destY,
        patchSize
    )
    
    // Frequency decomposition
    const blurRadius = Math.max(1, Math.floor(config.blurRadius))
    const sourceLowFreq = gaussianBlur(sourcePatch, blurRadius)
    const sourceHighFreq = new ImageData(patchSize, patchSize)
    const destLowFreq = gaussianBlur(destPatch, blurRadius)
    
    // Calculate high frequency (texture) = original - low frequency
    for (let i = 0; i < sourcePatch.data.length; i += 4) {
        sourceHighFreq.data[i] = sourcePatch.data[i] - sourceLowFreq.data[i] + 128
        sourceHighFreq.data[i + 1] = sourcePatch.data[i + 1] - sourceLowFreq.data[i + 1] + 128
        sourceHighFreq.data[i + 2] = sourcePatch.data[i + 2] - sourceLowFreq.data[i + 2] + 128
        sourceHighFreq.data[i + 3] = sourcePatch.data[i + 3]
    }
    
    // Adapt luminance and combine
    const healedPatch = adaptLuminance(sourceHighFreq, sourceLowFreq, destLowFreq, config.strength)
    
    // Apply circular mask for brush shape
    const mask = createCircularMask(patchSize, 0.8) // Slightly soft edges for natural blending
    for (let i = 0; i < mask.length; i++) {
        const alpha = mask[i] * config.strength
        healedPatch.data[i * 4 + 3] = Math.round(healedPatch.data[i * 4 + 3] * alpha)
    }
    
    return healedPatch
}

/**
 * Simplified healing for real-time strokes - faster but less accurate
 * Uses a simple luminance matching approach instead of full frequency separation
 */
export function healBrushDabFast(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    destCanvas: HTMLCanvasElement | OffscreenCanvas,
    sourceX: number,
    sourceY: number,
    destX: number,
    destY: number,
    brushSize: number,
    strength: number
): ImageData {
    // Ensure odd patch size for centering
    const patchSize = Math.max(3, brushSize % 2 === 0 ? brushSize + 1 : brushSize)
    const halfSize = Math.floor(patchSize / 2)
    
    // Get contexts
    const srcCtx = sourceCanvas.getContext('2d')!
    const destCtx = destCanvas.getContext('2d')!
    
    // Get source pixels
    const srcImageData = srcCtx.getImageData(
        Math.max(0, Math.round(sourceX - halfSize)),
        Math.max(0, Math.round(sourceY - halfSize)),
        patchSize,
        patchSize
    )
    
    // Get destination pixels for color matching
    const destImageData = destCtx.getImageData(
        Math.max(0, Math.round(destX - halfSize)),
        Math.max(0, Math.round(destY - halfSize)),
        patchSize,
        patchSize
    )
    
    // Calculate mean luminance of destination
    let destLumSum = 0
    let destCount = 0
    for (let i = 0; i < destImageData.data.length; i += 4) {
        if (destImageData.data[i + 3] > 10) {
            destLumSum += 0.299 * destImageData.data[i] + 0.587 * destImageData.data[i + 1] + 0.114 * destImageData.data[i + 2]
            destCount++
        }
    }
    const destLum = destCount > 0 ? destLumSum / destCount : 128
    
    // Calculate mean luminance of source
    let srcLumSum = 0
    let srcCount = 0
    for (let i = 0; i < srcImageData.data.length; i += 4) {
        if (srcImageData.data[i + 3] > 10) {
            srcLumSum += 0.299 * srcImageData.data[i] + 0.587 * srcImageData.data[i + 1] + 0.114 * srcImageData.data[i + 2]
            srcCount++
        }
    }
    const srcLum = srcCount > 0 ? srcLumSum / srcCount : 128
    
    // Luminance adjustment factor
    const lumFactor = srcLum > 1 ? destLum / srcLum : 1
    
    // Create result with luminance adjustment
    const result = new ImageData(patchSize, patchSize)
    const mask = createCircularMask(patchSize, 0.7)
    
    for (let i = 0; i < srcImageData.data.length; i += 4) {
        const maskAlpha = mask[i / 4]
        
        // Adjust source luminance to match destination
        const adjustedR = Math.min(255, Math.max(0, srcImageData.data[i] * lumFactor))
        const adjustedG = Math.min(255, Math.max(0, srcImageData.data[i + 1] * lumFactor))
        const adjustedB = Math.min(255, Math.max(0, srcImageData.data[i + 2] * lumFactor))
        
        // Blend with destination based on strength and mask
        const blend = maskAlpha * strength
        result.data[i] = Math.round(adjustedR * blend + destImageData.data[i] * (1 - blend))
        result.data[i + 1] = Math.round(adjustedG * blend + destImageData.data[i + 1] * (1 - blend))
        result.data[i + 2] = Math.round(adjustedB * blend + destImageData.data[i + 2] * (1 - blend))
        result.data[i + 3] = Math.round(255 * maskAlpha)
    }
    
    return result
}

/**
 * Create a healing canvas context for continuous strokes
 */
export function createHealingContext(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    destCanvas: HTMLCanvasElement | OffscreenCanvas,
    brushSize: number,
    opacity: number,
    _hardness: number // Reserved for future use
) {
    const config: HealConfig = {
        strength: opacity / 100,
        blurRadius: Math.max(1, Math.floor(brushSize / 10))
    }
    
    return {
        /**
         * Draw a healing stroke segment
         */
        stroke(
            sourceX: number,
            sourceY: number,
            destX: number,
            destY: number,
            ctx: CanvasRenderingContext2D,
            layerX: number,
            layerY: number
        ) {
            // Use fast healing for real-time interaction
            const healedPatch = healBrushDabFast(
                sourceCanvas,
                destCanvas,
                sourceX,
                sourceY,
                destX,
                destY,
                brushSize,
                config.strength
            )
            
            // Put the healed patch onto the destination context
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = healedPatch.width
            tempCanvas.height = healedPatch.height
            const tempCtx = tempCanvas.getContext('2d')!
            tempCtx.putImageData(healedPatch, 0, 0)
            
            // Draw to the target layer context
            const halfSize = Math.floor(healedPatch.width / 2)
            ctx.save()
            ctx.globalCompositeOperation = 'source-over'
            ctx.drawImage(
                tempCanvas,
                destX - layerX - halfSize,
                destY - layerY - halfSize
            )
            ctx.restore()
        },
        
        /**
         * End the stroke
         */
        endStroke() {
            // Reset state if needed
        }
    }
}
