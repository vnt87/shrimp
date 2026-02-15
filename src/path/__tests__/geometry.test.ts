import { describe, expect, it } from 'vitest'
import { appendNode, createPathNode, createVectorPath } from '../commands'
import { hitTestHandles, hitTestNodes, hitTestSegments } from '../geometry'

describe('path geometry', () => {
    it('hits nearest node within radius', () => {
        const path = appendNode(
            appendNode(createVectorPath(), createPathNode(10, 10)),
            createPathNode(100, 100)
        )

        const hit = hitTestNodes(path, { x: 12, y: 11 }, 6)
        expect(hit?.index).toBe(0)
        expect(hit?.nodeId).toBe(path.nodes[0].id)
    })

    it('hits handle within radius', () => {
        const a = createPathNode(50, 50)
        a.handleOut = { x: 70, y: 50 }
        const path = appendNode(createVectorPath(), a)

        const hit = hitTestHandles(path, { x: 69, y: 49 }, 4)
        expect(hit?.handle).toBe('handleOut')
        expect(hit?.nodeId).toBe(a.id)
    })

    it('hits nearest segment and returns t', () => {
        const path = appendNode(
            appendNode(createVectorPath(), createPathNode(0, 0)),
            createPathNode(100, 0)
        )

        const hit = hitTestSegments(path, { x: 45, y: 2 }, 5, 1)
        expect(hit).toBeTruthy()
        expect(hit!.segmentIndex).toBe(0)
        expect(hit!.t).toBeGreaterThan(0.3)
        expect(hit!.t).toBeLessThan(0.6)
    })
})
