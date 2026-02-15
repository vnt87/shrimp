import { flattenPath } from './flatten'
import type { PathBounds, PathSelectionPolygon, Vec2, VectorPath } from './types'

interface CanvasLike {
    width: number
    height: number
    getContext: (contextId: '2d') => CanvasRenderingContext2D | null
}

type CanvasFactory = () => CanvasLike

function defaultCanvasFactory(): CanvasLike {
    return document.createElement('canvas') as HTMLCanvasElement
}

function computeBounds(points: Vec2[]): PathBounds {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const point of points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
    }

    return { minX, minY, maxX, maxY }
}

export function drawVectorPathToContext(ctx: CanvasRenderingContext2D, path: VectorPath): void {
    if (path.nodes.length === 0) return

    const first = path.nodes[0]
    ctx.moveTo(first.x, first.y)

    for (let i = 1; i < path.nodes.length; i++) {
        const prev = path.nodes[i - 1]
        const next = path.nodes[i]

        const cp1 = prev.handleOut ?? { x: prev.x, y: prev.y }
        const cp2 = next.handleIn ?? { x: next.x, y: next.y }
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, next.x, next.y)
    }

    if (path.closed && path.nodes.length > 2) {
        const end = path.nodes[path.nodes.length - 1]
        const start = path.nodes[0]
        const cp1 = end.handleOut ?? { x: end.x, y: end.y }
        const cp2 = start.handleIn ?? { x: start.x, y: start.y }
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, start.x, start.y)
        ctx.closePath()
    }
}

export function pathToSelectionPolygon(path: VectorPath, tolerance: number = 1, forceCloseOpenPath: boolean = true): PathSelectionPolygon | null {
    if (path.nodes.length < 2) return null

    const points = flattenPath(path, tolerance, forceCloseOpenPath)
    if (points.length < 3) return null

    return {
        points,
        bounds: computeBounds(points)
    }
}

interface RasterizeParams {
    path: VectorPath
    canvasWidth: number
    canvasHeight: number
    color: string
    lineWidth?: number
    canvasFactory?: CanvasFactory
}

export function createFilledPathCanvas(params: RasterizeParams): HTMLCanvasElement | null {
    const { path, canvasWidth, canvasHeight, color } = params
    const canvasFactory = params.canvasFactory ?? defaultCanvasFactory

    if (!path.closed || path.nodes.length < 3) return null

    const canvas = canvasFactory()
    canvas.width = canvasWidth
    canvas.height = canvasHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.beginPath()
    drawVectorPathToContext(ctx, path)
    ctx.fillStyle = color
    ctx.fill()

    return canvas as HTMLCanvasElement
}

export function createStrokedPathCanvas(params: RasterizeParams): HTMLCanvasElement | null {
    const { path, canvasWidth, canvasHeight, color, lineWidth = 1 } = params
    const canvasFactory = params.canvasFactory ?? defaultCanvasFactory

    if (path.nodes.length < 2) return null

    const canvas = canvasFactory()
    canvas.width = canvasWidth
    canvas.height = canvasHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.beginPath()
    drawVectorPathToContext(ctx, path)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    return canvas as HTMLCanvasElement
}
