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
        selectionContains
    } = params

    const output = cloneCanvas(baseCanvas)
    const ctx = output.getContext('2d')
    if (!ctx) return output

    const imageData = ctx.getImageData(0, 0, output.width, output.height)
    const data = imageData.data

    const [fgR, fgG, fgB] = hexToRgb(foregroundColor)
    const [bgR, bgG, bgB] = hexToRgb(backgroundColor)
    const toolAlpha = clamp01(opacity / 100)

    const dx = end.x - start.x
    const dy = end.y - start.y
    const lenSq = dx * dx + dy * dy
    const radius = Math.sqrt(lenSq)

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

            const srcR = Math.round(mix(fgR, bgR, t))
            const srcG = Math.round(mix(fgG, bgG, t))
            const srcB = Math.round(mix(fgB, bgB, t))
            const srcA = toolAlpha

            const i = (y * output.width + x) * 4
            const dstR = data[i]
            const dstG = data[i + 1]
            const dstB = data[i + 2]
            const dstA = data[i + 3] / 255

            const outA = srcA + dstA * (1 - srcA)
            if (outA <= 0) {
                data[i] = 0
                data[i + 1] = 0
                data[i + 2] = 0
                data[i + 3] = 0
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
