import type { FlattenedSegment, FlatSegmentSample, PathNode, Vec2, VectorPath } from './types'

const MAX_DEPTH = 10

function distPointToLineSq(p: Vec2, a: Vec2, b: Vec2): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) {
        const ddx = p.x - a.x
        const ddy = p.y - a.y
        return ddx * ddx + ddy * ddy
    }

    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    const ddx = p.x - projX
    const ddy = p.y - projY
    return ddx * ddx + ddy * ddy
}

function isFlatEnough(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tolerance: number): boolean {
    const tolSq = tolerance * tolerance
    return distPointToLineSq(p1, p0, p3) <= tolSq && distPointToLineSq(p2, p0, p3) <= tolSq
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    }
}

function flattenCubicAdaptive(
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
    t0: number,
    t1: number,
    tolerance: number,
    out: FlatSegmentSample[],
    depth: number
): void {
    if (depth >= MAX_DEPTH || isFlatEnough(p0, p1, p2, p3, tolerance)) {
        out.push({ x: p3.x, y: p3.y, t: t1 })
        return
    }

    const p01 = midpoint(p0, p1)
    const p12 = midpoint(p1, p2)
    const p23 = midpoint(p2, p3)

    const p012 = midpoint(p01, p12)
    const p123 = midpoint(p12, p23)

    const p0123 = midpoint(p012, p123)
    const tm = (t0 + t1) / 2

    flattenCubicAdaptive(p0, p01, p012, p0123, t0, tm, tolerance, out, depth + 1)
    flattenCubicAdaptive(p0123, p123, p23, p3, tm, t1, tolerance, out, depth + 1)
}

function getSegmentNodes(path: VectorPath, segmentIndex: number): { a: PathNode; b: PathNode } | null {
    const n = path.nodes.length
    if (n < 2) return null

    const max = path.closed ? n : n - 1
    if (segmentIndex < 0 || segmentIndex >= max) return null

    const a = path.nodes[segmentIndex]
    const b = path.nodes[segmentIndex === n - 1 ? 0 : segmentIndex + 1]
    return { a, b }
}

function flattenSingleSegment(path: VectorPath, segmentIndex: number, tolerance: number): FlattenedSegment | null {
    const nodes = getSegmentNodes(path, segmentIndex)
    if (!nodes) return null

    const p0: Vec2 = { x: nodes.a.x, y: nodes.a.y }
    const p1: Vec2 = nodes.a.handleOut ? { ...nodes.a.handleOut } : { x: nodes.a.x, y: nodes.a.y }
    const p2: Vec2 = nodes.b.handleIn ? { ...nodes.b.handleIn } : { x: nodes.b.x, y: nodes.b.y }
    const p3: Vec2 = { x: nodes.b.x, y: nodes.b.y }

    const samples: FlatSegmentSample[] = [{ x: p0.x, y: p0.y, t: 0 }]
    flattenCubicAdaptive(p0, p1, p2, p3, 0, 1, Math.max(0.1, tolerance), samples, 0)

    return {
        segmentIndex,
        samples
    }
}

export function flattenPathSegments(path: VectorPath, tolerance: number = 1): FlattenedSegment[] {
    if (path.nodes.length < 2) return []

    const segmentCount = path.closed ? path.nodes.length : path.nodes.length - 1
    const out: FlattenedSegment[] = []

    for (let i = 0; i < segmentCount; i++) {
        const flat = flattenSingleSegment(path, i, tolerance)
        if (flat) out.push(flat)
    }

    return out
}

export function flattenPath(path: VectorPath, tolerance: number = 1, forceClosed: boolean = false): Vec2[] {
    if (path.nodes.length === 0) return []
    if (path.nodes.length === 1) return [{ x: path.nodes[0].x, y: path.nodes[0].y }]

    const result: Vec2[] = []
    const segments = flattenPathSegments(path, tolerance)

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        for (let j = 0; j < segment.samples.length; j++) {
            if (i > 0 && j === 0) continue
            const sample = segment.samples[j]
            result.push({ x: sample.x, y: sample.y })
        }
    }

    if (!path.closed && forceClosed && path.nodes.length > 2) {
        result.push({ x: path.nodes[0].x, y: path.nodes[0].y })
    }

    if (path.closed && result.length > 0) {
        const first = result[0]
        const last = result[result.length - 1]
        if (first.x !== last.x || first.y !== last.y) {
            result.push({ ...first })
        }
    }

    return result
}
