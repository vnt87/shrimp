export type Vec2 = { x: number; y: number }

export type PathNodeType = 'corner' | 'smooth'

export interface PathNode {
    id: string
    x: number
    y: number
    handleIn: Vec2 | null
    handleOut: Vec2 | null
    type: PathNodeType
}

export interface VectorPath {
    id: string
    name: string
    visible: boolean
    locked: boolean
    closed: boolean
    nodes: PathNode[]
    createdAt: number
    updatedAt: number
}

export interface PathBounds {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

export interface PathSelectionPolygon {
    points: Vec2[]
    bounds: PathBounds
}

export interface FlatSegmentSample {
    x: number
    y: number
    t: number
}

export interface FlattenedSegment {
    segmentIndex: number
    samples: FlatSegmentSample[]
}
