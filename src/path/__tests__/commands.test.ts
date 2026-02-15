import { describe, expect, it } from 'vitest'
import {
    appendNode,
    createPathNode,
    createVectorPath,
    deleteNode,
    insertNodeOnSegment,
    moveHandle,
    moveNode,
    setNodeType,
    toggleClosed,
    translatePath
} from '../commands'

describe('path commands', () => {
    it('appends and deletes nodes immutably', () => {
        const base = createVectorPath('Test')
        const n1 = createPathNode(10, 20)
        const n2 = createPathNode(30, 40)

        const withOne = appendNode(base, n1)
        const withTwo = appendNode(withOne, n2)

        expect(base.nodes).toHaveLength(0)
        expect(withTwo.nodes).toHaveLength(2)

        const removed = deleteNode(withTwo, n1.id)
        expect(removed.nodes).toHaveLength(1)
        expect(withTwo.nodes).toHaveLength(2)
    })

    it('closes only when enough nodes exist', () => {
        const p0 = appendNode(createVectorPath(), createPathNode(0, 0))
        const p1 = appendNode(p0, createPathNode(50, 0))
        const p2 = appendNode(p1, createPathNode(50, 50))

        expect(toggleClosed(p1, true).closed).toBe(false)
        expect(toggleClosed(p2, true).closed).toBe(true)
    })

    it('moves node and handles together', () => {
        const n = createPathNode(10, 10)
        n.handleIn = { x: 5, y: 10 }
        n.handleOut = { x: 15, y: 10 }
        const path = appendNode(createVectorPath(), n)

        const moved = moveNode(path, n.id, 20, 30)
        expect(moved.nodes[0].x).toBe(20)
        expect(moved.nodes[0].y).toBe(30)
        expect(moved.nodes[0].handleIn).toEqual({ x: 15, y: 30 })
        expect(moved.nodes[0].handleOut).toEqual({ x: 25, y: 30 })
    })

    it('mirrors smooth handles when moving one handle', () => {
        const n = createPathNode(100, 100)
        n.type = 'smooth'
        n.handleOut = { x: 120, y: 100 }
        n.handleIn = { x: 80, y: 100 }

        const path = appendNode(createVectorPath(), n)
        const moved = moveHandle(path, n.id, 'handleOut', { x: 130, y: 110 }, true)

        expect(moved.nodes[0].handleOut).toEqual({ x: 130, y: 110 })
        expect(moved.nodes[0].handleIn).toEqual({ x: 70, y: 90 })
    })

    it('inserts node on segment with split handles', () => {
        const a = createPathNode(0, 0)
        a.handleOut = { x: 40, y: 0 }
        const b = createPathNode(100, 0)
        b.handleIn = { x: 60, y: 0 }

        const base = appendNode(appendNode(createVectorPath(), a), b)
        const inserted = insertNodeOnSegment(base, 0, 0.5)

        expect(inserted.nodeId).toBeTruthy()
        expect(inserted.path.nodes).toHaveLength(3)
    })

    it('translates entire path', () => {
        const p = appendNode(
            appendNode(createVectorPath(), createPathNode(0, 0)),
            createPathNode(10, 20)
        )

        const moved = translatePath(p, 5, -5)
        expect(moved.nodes[0]).toMatchObject({ x: 5, y: -5 })
        expect(moved.nodes[1]).toMatchObject({ x: 15, y: 15 })
    })

    it('toggles node type', () => {
        const node = createPathNode(0, 0)
        const path = appendNode(createVectorPath(), node)

        const smooth = setNodeType(path, node.id, 'smooth')
        expect(smooth.nodes[0].type).toBe('smooth')
    })
})
