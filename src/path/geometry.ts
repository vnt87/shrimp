import { flattenPathSegments } from './flatten'
import type { FlattenedSegment, Vec2, VectorPath } from './types'

export interface NodeHit {
    index: number
    nodeId: string
    distance: number
}

export interface HandleHit {
    index: number
    nodeId: string
    handle: 'handleIn' | 'handleOut'
    distance: number
}

export interface SegmentHit {
    segmentIndex: number
    distance: number
    t: number
}

export function distance(a: Vec2, b: Vec2): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

export function hitTestNodes(path: VectorPath, point: Vec2, radius: number): NodeHit | null {
    let best: NodeHit | null = null
    for (let i = 0; i < path.nodes.length; i++) {
        const node = path.nodes[i]
        const dist = distance(point, { x: node.x, y: node.y })
        if (dist > radius) continue
        if (!best || dist < best.distance) {
            best = { index: i, nodeId: node.id, distance: dist }
        }
    }
    return best
}

export function hitTestHandles(path: VectorPath, point: Vec2, radius: number): HandleHit | null {
    let best: HandleHit | null = null

    for (let i = 0; i < path.nodes.length; i++) {
        const node = path.nodes[i]
        const options: Array<'handleIn' | 'handleOut'> = ['handleIn', 'handleOut']
        for (const handle of options) {
            const pos = node[handle]
            if (!pos) continue
            const dist = distance(point, pos)
            if (dist > radius) continue
            if (!best || dist < best.distance) {
                best = { index: i, nodeId: node.id, handle, distance: dist }
            }
        }
    }

    return best
}

function nearestProjectionOnLine(point: Vec2, a: Vec2, b: Vec2): { distance: number; lineT: number } {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy

    if (lenSq === 0) {
        return {
            distance: distance(point, a),
            lineT: 0
        }
    }

    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq))
    const proj = {
        x: a.x + dx * t,
        y: a.y + dy * t
    }

    return {
        distance: distance(point, proj),
        lineT: t
    }
}

export function hitTestSegments(
    path: VectorPath,
    point: Vec2,
    radius: number,
    tolerance: number,
    segmentsCache?: FlattenedSegment[]
): SegmentHit | null {
    if (path.nodes.length < 2) return null

    const segments = segmentsCache ?? flattenPathSegments(path, tolerance)
    let best: SegmentHit | null = null

    for (const segment of segments) {
        const samples = segment.samples
        for (let i = 1; i < samples.length; i++) {
            const a = samples[i - 1]
            const b = samples[i]
            const proj = nearestProjectionOnLine(point, a, b)
            if (proj.distance > radius) continue

            const t = a.t + (b.t - a.t) * proj.lineT
            if (!best || proj.distance < best.distance) {
                best = {
                    segmentIndex: segment.segmentIndex,
                    distance: proj.distance,
                    t
                }
            }
        }
    }

    return best
}
