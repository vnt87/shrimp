import { GradientResource } from '../types/gradient'
import { generateGradientLUT } from './gradientMath'

export type GradientType = 'linear' | 'radial'
export type GradientAffectedArea = 'layer' | 'selection'

interface Point {
    x: number
    y: number
}

interface RenderGradientParams {
    baseCanvas: HTMLCanvasElement
    layerX: number
    layerY: number
    start: Point
    end: Point
    foregroundColor: string
    backgroundColor: string
    reverse: boolean
    opacity: number // 0..100
    type: GradientType
    affectedArea: GradientAffectedArea
    selectionContains?: (canvasX: number, canvasY: number) => boolean
    gradientResource?: GradientResource | null
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const hexToRgb = (hex: string): [number, number, number] => {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex
    if (normalized.length !== 6) return [0, 0, 0]

    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    return [r, g, b]
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const cloned = document.createElement('canvas')
    cloned.width = source.width
    cloned.height = source.height
    const ctx = cloned.getContext('2d')
    ctx?.drawImage(source, 0, 0)
    return cloned
}

// Cache LUTs to avoid re-generating for the same gradient during drag
const LUT_CACHE = new Map<string, Uint8ClampedArray>();

export function renderGradientToLayer(params: RenderGradientParams): HTMLCanvasElement {
    const {
        baseCanvas,
        layerX,
        layerY,
        start,
        end,
        foregroundColor,
        backgroundColor,
        reverse,
        opacity,
        type,
        affectedArea,
        selectionContains,
        gradientResource
    } = params

    const output = cloneCanvas(baseCanvas)
    const ctx = output.getContext('2d')
    if (!ctx) return output

    const imageData = ctx.getImageData(0, 0, output.width, output.height)
    const data = imageData.data

    const toolAlpha = clamp01(opacity / 100)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lenSq = dx * dx + dy * dy
    const radius = Math.sqrt(lenSq)

    // Prepared colors for fallback (simple 2-color)
    const [fgR, fgG, fgB] = hexToRgb(foregroundColor)
    const [bgR, bgG, bgB] = hexToRgb(backgroundColor)

    // LUT Preparation
    let lut: Uint8ClampedArray | null = null;
    let lutSize = 0;

    if (gradientResource) {
        if (!LUT_CACHE.has(gradientResource.id)) {
            LUT_CACHE.set(gradientResource.id, generateGradientLUT(gradientResource));
        }
        lut = LUT_CACHE.get(gradientResource.id)!;
        lutSize = lut.length / 4;
    }

    for (let y = 0; y < output.height; y++) {
        for (let x = 0; x < output.width; x++) {
            const canvasX = x + layerX
            const canvasY = y + layerY

            if (affectedArea === 'selection' && selectionContains && !selectionContains(canvasX, canvasY)) {
                continue
            }

            let t = 0
            if (type === 'radial') {
                if (radius > 0.0001) {
                    const pdx = canvasX - start.x
                    const pdy = canvasY - start.y
                    t = clamp01(Math.sqrt(pdx * pdx + pdy * pdy) / radius)
                } else {
                    t = 0
                }
            } else {
                if (lenSq > 0.0001) {
                    const pdx = canvasX - start.x
                    const pdy = canvasY - start.y
                    t = clamp01((pdx * dx + pdy * dy) / lenSq)
                } else {
                    t = 0
                }
            }

            if (reverse) t = 1 - t

            let srcR, srcG, srcB, srcA;

            if (lut) {
                // LUT Lookup
                const lutIndex = Math.floor(t * (lutSize - 1)) * 4;
                srcR = lut[lutIndex];
                srcG = lut[lutIndex + 1];
                srcB = lut[lutIndex + 2];
                srcA = (lut[lutIndex + 3] / 255) * toolAlpha;
            } else {
                // Fallback Linear Interpolation
                srcR = Math.round(mix(fgR, bgR, t))
                srcG = Math.round(mix(fgG, bgG, t))
                srcB = Math.round(mix(fgB, bgB, t))
                srcA = toolAlpha
            }

            const i = (y * output.width + x) * 4
            const dstR = data[i]
            const dstG = data[i + 1]
            const dstB = data[i + 2]
            const dstA = data[i + 3] / 255

            const outA = srcA + dstA * (1 - srcA)
            if (outA <= 0) {
                data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
                continue
            }

            data[i] = Math.round((srcR * srcA + dstR * dstA * (1 - srcA)) / outA)
            data[i + 1] = Math.round((srcG * srcA + dstG * dstA * (1 - srcA)) / outA)
            data[i + 2] = Math.round((srcB * srcA + dstB * dstA * (1 - srcA)) / outA)
            data[i + 3] = Math.round(outA * 255)
        }
    }

    ctx.putImageData(imageData, 0, 0)
    return output
}
