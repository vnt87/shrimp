import { describe, expect, it, vi } from 'vitest'
import { appendNode, createPathNode, createVectorPath, toggleClosed } from '../commands'
import { createFilledPathCanvas, createStrokedPathCanvas, pathToSelectionPolygon } from '../rasterize'

function makeCanvasMock() {
    const ctx: Partial<CanvasRenderingContext2D> = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        lineCap: 'round',
        lineJoin: 'round',
        lineWidth: 1,
        fillStyle: '#000',
        strokeStyle: '#000'
    }

    const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ctx as CanvasRenderingContext2D)
    }

    return { canvas, ctx }
}

describe('path rasterize helpers', () => {
    it('creates selection polygon and bounds', () => {
        const path = appendNode(
            appendNode(
                appendNode(createVectorPath(), createPathNode(0, 0)),
                createPathNode(100, 0)
            ),
            createPathNode(100, 100)
        )

        const selection = pathToSelectionPolygon(path, 1, true)
        expect(selection).toBeTruthy()
        expect(selection!.points.length).toBeGreaterThan(2)
        expect(selection!.bounds.minX).toBe(0)
        expect(selection!.bounds.minY).toBe(0)
    })

    it('fills only closed paths', () => {
        const openPath = appendNode(
            appendNode(
                appendNode(createVectorPath(), createPathNode(0, 0)),
                createPathNode(100, 0)
            ),
            createPathNode(100, 100)
        )

        const openResult = createFilledPathCanvas({
            path: openPath,
            canvasWidth: 200,
            canvasHeight: 200,
            color: '#ff0000'
        })
        expect(openResult).toBeNull()

        const closedPath = toggleClosed(openPath, true)
        const mock = makeCanvasMock()
        const filled = createFilledPathCanvas({
            path: closedPath,
            canvasWidth: 200,
            canvasHeight: 200,
            color: '#ff0000',
            canvasFactory: () => mock.canvas as any
        })

        expect(filled).toBeTruthy()
        expect(mock.canvas.width).toBe(200)
        expect(mock.canvas.height).toBe(200)
        expect(mock.ctx.fill).toHaveBeenCalled()
    })

    it('strokes open or closed paths', () => {
        const path = appendNode(
            appendNode(createVectorPath(), createPathNode(0, 0)),
            createPathNode(100, 0)
        )

        const mock = makeCanvasMock()
        const stroked = createStrokedPathCanvas({
            path,
            canvasWidth: 120,
            canvasHeight: 80,
            color: '#00ff00',
            lineWidth: 7,
            canvasFactory: () => mock.canvas as any
        })

        expect(stroked).toBeTruthy()
        expect(mock.ctx.stroke).toHaveBeenCalled()
        expect(mock.ctx.lineWidth).toBe(7)
    })
})
