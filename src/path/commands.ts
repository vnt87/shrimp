import type { PathNode, PathNodeType, Vec2, VectorPath } from './types'

const EPS = 1e-6

export function makeId(prefix: string = ''): string {
    return `${prefix}${Math.random().toString(36).slice(2, 11)}`
}

export function createPathNode(x: number, y: number, type: PathNodeType = 'corner'): PathNode {
    return {
        id: makeId('node_'),
        x,
        y,
        handleIn: null,
        handleOut: null,
        type
    }
}

export function createVectorPath(name: string = 'Path'): VectorPath {
    const now = Date.now()
    return {
        id: makeId('path_'),
        name,
        visible: true,
        locked: false,
        closed: false,
        nodes: [],
        createdAt: now,
        updatedAt: now
    }
}

function touch(path: VectorPath): VectorPath {
    return { ...path, updatedAt: Date.now() }
}

function cloneNode(node: PathNode): PathNode {
    return {
        ...node,
        handleIn: node.handleIn ? { ...node.handleIn } : null,
        handleOut: node.handleOut ? { ...node.handleOut } : null
    }
}

function sanitizeHandle(anchor: Vec2, handle: Vec2): Vec2 | null {
    if (Math.hypot(anchor.x - handle.x, anchor.y - handle.y) < EPS) return null
    return handle
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    }
}

function getSegmentIndices(path: VectorPath, segmentIndex: number): { from: number; to: number } | null {
    const n = path.nodes.length
    if (n < 2) return null

    const max = path.closed ? n : n - 1
    if (segmentIndex < 0 || segmentIndex >= max) return null

    const from = segmentIndex
    const to = segmentIndex === n - 1 ? 0 : segmentIndex + 1
    return { from, to }
}

export function appendNode(path: VectorPath, node: PathNode): VectorPath {
    return touch({
        ...path,
        nodes: [...path.nodes, node]
    })
}

export function deleteNode(path: VectorPath, nodeId: string): VectorPath {
    const nodes = path.nodes.filter((node) => node.id !== nodeId)
    const closed = nodes.length >= 3 ? path.closed : false
    return touch({ ...path, nodes, closed })
}

export function toggleClosed(path: VectorPath, closed?: boolean): VectorPath {
    const next = closed ?? !path.closed
    if (next && path.nodes.length < 3) return path
    return touch({ ...path, closed: next })
}

export function translatePath(path: VectorPath, dx: number, dy: number): VectorPath {
    if (dx === 0 && dy === 0) return path

    return touch({
        ...path,
        nodes: path.nodes.map((node) => ({
            ...node,
            x: node.x + dx,
            y: node.y + dy,
            handleIn: node.handleIn ? { x: node.handleIn.x + dx, y: node.handleIn.y + dy } : null,
            handleOut: node.handleOut ? { x: node.handleOut.x + dx, y: node.handleOut.y + dy } : null
        }))
    })
}

export function moveNode(path: VectorPath, nodeId: string, x: number, y: number): VectorPath {
    const index = path.nodes.findIndex((node) => node.id === nodeId)
    if (index < 0) return path

    const target = path.nodes[index]
    const dx = x - target.x
    const dy = y - target.y

    const nodes = [...path.nodes]
    nodes[index] = {
        ...target,
        x,
        y,
        handleIn: target.handleIn ? { x: target.handleIn.x + dx, y: target.handleIn.y + dy } : null,
        handleOut: target.handleOut ? { x: target.handleOut.x + dx, y: target.handleOut.y + dy } : null
    }

    return touch({ ...path, nodes })
}

export function setNodeType(path: VectorPath, nodeId: string, type: PathNodeType): VectorPath {
    const index = path.nodes.findIndex((node) => node.id === nodeId)
    if (index < 0) return path

    const nodes = [...path.nodes]
    const node = cloneNode(nodes[index])
    node.type = type

    if (type === 'smooth') {
        if (node.handleOut && !node.handleIn) {
            node.handleIn = {
                x: node.x - (node.handleOut.x - node.x),
                y: node.y - (node.handleOut.y - node.y)
            }
        } else if (node.handleIn && !node.handleOut) {
            node.handleOut = {
                x: node.x - (node.handleIn.x - node.x),
                y: node.y - (node.handleIn.y - node.y)
            }
        }
    }

    nodes[index] = node
    return touch({ ...path, nodes })
}

export function moveHandle(
    path: VectorPath,
    nodeId: string,
    handle: 'handleIn' | 'handleOut',
    position: Vec2,
    mirror: boolean
): VectorPath {
    const index = path.nodes.findIndex((node) => node.id === nodeId)
    if (index < 0) return path

    const nodes = [...path.nodes]
    const node = cloneNode(nodes[index])
    node[handle] = { ...position }

    if (mirror && node.type === 'smooth') {
        const dx = position.x - node.x
        const dy = position.y - node.y
        const opposite = { x: node.x - dx, y: node.y - dy }
        if (handle === 'handleIn') {
            node.handleOut = opposite
        } else {
            node.handleIn = opposite
        }
    }

    if (!mirror) {
        node.type = 'corner'
    }

    nodes[index] = node
    return touch({ ...path, nodes })
}

export function insertNodeOnSegment(path: VectorPath, segmentIndex: number, tRaw: number): { path: VectorPath; nodeId: string | null } {
    const indices = getSegmentIndices(path, segmentIndex)
    if (!indices) return { path, nodeId: null }

    const t = Math.min(1, Math.max(0, tRaw))
    const { from, to } = indices
    const nodes = path.nodes.map(cloneNode)

    const a = nodes[from]
    const b = nodes[to]

    const p0: Vec2 = { x: a.x, y: a.y }
    const p1: Vec2 = a.handleOut ? { ...a.handleOut } : { x: a.x, y: a.y }
    const p2: Vec2 = b.handleIn ? { ...b.handleIn } : { x: b.x, y: b.y }
    const p3: Vec2 = { x: b.x, y: b.y }

    const p01 = lerp(p0, p1, t)
    const p12 = lerp(p1, p2, t)
    const p23 = lerp(p2, p3, t)
    const p012 = lerp(p01, p12, t)
    const p123 = lerp(p12, p23, t)
    const p0123 = lerp(p012, p123, t)

    const hasAnyHandle = !!(a.handleOut || b.handleIn)

    const newNode: PathNode = {
        id: makeId('node_'),
        x: p0123.x,
        y: p0123.y,
        handleIn: hasAnyHandle ? sanitizeHandle(p0123, p012) : null,
        handleOut: hasAnyHandle ? sanitizeHandle(p0123, p123) : null,
        type: hasAnyHandle ? 'smooth' : 'corner'
    }

    a.handleOut = hasAnyHandle ? sanitizeHandle(p0, p01) : null
    b.handleIn = hasAnyHandle ? sanitizeHandle(p3, p23) : null

    const insertionIndex = from === nodes.length - 1 && to === 0 ? nodes.length : from + 1
    const nextNodes = [...nodes.slice(0, insertionIndex), newNode, ...nodes.slice(insertionIndex)]

    return {
        path: touch({ ...path, nodes: nextNodes }),
        nodeId: newNode.id
    }
}

export function duplicatePath(path: VectorPath, name?: string): VectorPath {
    const now = Date.now()
    return {
        ...path,
        id: makeId('path_'),
        name: name ?? `${path.name} Copy`,
        nodes: path.nodes.map((node) => ({
            ...cloneNode(node),
            id: makeId('node_')
        })),
        createdAt: now,
        updatedAt: now
    }
}
