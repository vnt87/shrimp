import { describe, expect, it } from 'vitest'
import { appendNode, createPathNode, createVectorPath, toggleClosed } from '../commands'
import { flattenPath, flattenPathSegments } from '../flatten'

describe('path flattening', () => {
    it('flattens open path with correct endpoints', () => {
        const a = createPathNode(0, 0)
        a.handleOut = { x: 25, y: 50 }
        const b = createPathNode(100, 0)
        b.handleIn = { x: 75, y: 50 }

        const path = appendNode(appendNode(createVectorPath(), a), b)
        const points = flattenPath(path, 1)

        expect(points.length).toBeGreaterThan(2)
        expect(points[0]).toEqual({ x: 0, y: 0 })
        expect(points[points.length - 1]).toEqual({ x: 100, y: 0 })
    })

    it('returns segment samples for each segment', () => {
        const path = appendNode(
            appendNode(
                appendNode(createVectorPath(), createPathNode(0, 0)),
                createPathNode(100, 0)
            ),
            createPathNode(100, 100)
        )

        const flat = flattenPathSegments(path, 1)
        expect(flat).toHaveLength(2)
        expect(flat[0].samples.length).toBeGreaterThan(1)
        expect(flat[1].samples.length).toBeGreaterThan(1)
    })

    it('forces close for selection flattening', () => {
        const path = appendNode(
            appendNode(
                appendNode(createVectorPath(), createPathNode(0, 0)),
                createPathNode(100, 0)
            ),
            createPathNode(100, 100)
        )

        const forced = flattenPath(path, 1, true)
        expect(forced[0]).toEqual(forced[forced.length - 1])

        const closed = toggleClosed(path, true)
        const naturallyClosed = flattenPath(closed, 1)
        expect(naturallyClosed[0]).toEqual(naturallyClosed[naturallyClosed.length - 1])
    })
})
