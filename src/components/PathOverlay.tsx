import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from './EditorContext'
import { appendNode, createPathNode, deleteNode, insertNodeOnSegment, moveHandle, moveNode, setNodeType, toggleClosed, translatePath } from '../path/commands'
import { flattenPathSegments } from '../path/flatten'
import { distance, hitTestHandles, hitTestNodes, hitTestSegments } from '../path/geometry'
import type { Vec2, VectorPath } from '../path/types'
import type { ToolOptions } from '../App'

interface PathOverlayProps {
    zoomLevel: number
    toolOptions?: ToolOptions
}

type DragState =
    | {
        kind: 'node'
        pathId: string
        nodeId: string
        basePath: VectorPath
        commitHistory: boolean
    }
    | {
        kind: 'handle'
        pathId: string
        nodeId: string
        handle: 'handleIn' | 'handleOut'
        basePath: VectorPath
        commitHistory: boolean
    }
    | {
        kind: 'path'
        pathId: string
        start: Vec2
        basePath: VectorPath
        commitHistory: boolean
    }
    | {
        kind: 'newNodeHandle'
        pathId: string
        nodeId: string
        basePath: VectorPath
        commitHistory: boolean
    }

function toPathD(path: VectorPath): string {
    if (path.nodes.length === 0) return ''

    let d = `M ${path.nodes[0].x} ${path.nodes[0].y}`

    for (let i = 1; i < path.nodes.length; i++) {
        const prev = path.nodes[i - 1]
        const curr = path.nodes[i]
        const cp1 = prev.handleOut ?? { x: prev.x, y: prev.y }
        const cp2 = curr.handleIn ?? { x: curr.x, y: curr.y }
        d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${curr.x} ${curr.y}`
    }

    if (path.closed && path.nodes.length > 2) {
        const end = path.nodes[path.nodes.length - 1]
        const start = path.nodes[0]
        const cp1 = end.handleOut ?? { x: end.x, y: end.y }
        const cp2 = start.handleIn ?? { x: start.x, y: start.y }
        d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${start.x} ${start.y} Z`
    }

    return d
}

export default function PathOverlay({ zoomLevel, toolOptions }: PathOverlayProps) {
    const {
        paths,
        activePathId,
        activePath,
        activePathNodeId,
        createPath,
        setActivePathId,
        updatePath,
        deletePath,
        setActivePathNodeId
    } = useEditor()

    const svgRef = useRef<SVGSVGElement>(null)

    const [dragState, setDragState] = useState<DragState | null>(null)
    const [previewPath, setPreviewPath] = useState<VectorPath | null>(null)
    const [mouseCanvasPos, setMouseCanvasPos] = useState<Vec2 | null>(null)

    const pathMode = toolOptions?.pathMode || 'design'
    const isPolygonal = !!toolOptions?.pathPolygonal

    const displayedActivePath = previewPath ?? activePath
    const editableActivePath = displayedActivePath && !displayedActivePath.locked ? displayedActivePath : null

    const flatSegments = useMemo(() => {
        if (!editableActivePath) return []
        const tolerance = Math.max(0.35, 1.5 / Math.max(zoomLevel, 0.001))
        return flattenPathSegments(editableActivePath, tolerance)
    }, [editableActivePath, zoomLevel])

    const toCanvas = useCallback((clientX: number, clientY: number): Vec2 => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }

        const ctm = svg.getScreenCTM()
        if (!ctm) return { x: 0, y: 0 }

        const pt = svg.createSVGPoint()
        pt.x = clientX
        pt.y = clientY
        const local = pt.matrixTransform(ctm.inverse())
        return { x: local.x, y: local.y }
    }, [])

    const isNearStartPoint = useCallback((path: VectorPath | null, point: Vec2): boolean => {
        if (!path || path.closed || path.nodes.length < 3) return false
        return distance(point, { x: path.nodes[0].x, y: path.nodes[0].y }) < 10 / Math.max(zoomLevel, 0.001)
    }, [zoomLevel])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return
        e.stopPropagation()

        const canvasPoint = toCanvas(e.clientX, e.clientY)
        setMouseCanvasPos(canvasPoint)

        if (pathMode === 'move') {
            if (!editableActivePath || !activePathId) return
            const radius = 8 / Math.max(zoomLevel, 0.001)
            const hasHit =
                hitTestHandles(editableActivePath, canvasPoint, radius) ||
                hitTestNodes(editableActivePath, canvasPoint, radius) ||
                hitTestSegments(editableActivePath, canvasPoint, radius, 1 / Math.max(zoomLevel, 0.001), flatSegments)

            if (!hasHit) return

            setDragState({
                kind: 'path',
                pathId: activePathId,
                start: canvasPoint,
                basePath: editableActivePath,
                commitHistory: true
            })
            return
        }

        if (pathMode === 'edit') {
            if (!editableActivePath || !activePathId) {
                setActivePathNodeId(null)
                return
            }

            const radius = 8 / Math.max(zoomLevel, 0.001)
            const handleHit = hitTestHandles(editableActivePath, canvasPoint, radius)
            if (handleHit) {
                setActivePathNodeId(handleHit.nodeId)
                setDragState({
                    kind: 'handle',
                    pathId: activePathId,
                    nodeId: handleHit.nodeId,
                    handle: handleHit.handle,
                    basePath: editableActivePath,
                    commitHistory: true
                })
                return
            }

            const nodeHit = hitTestNodes(editableActivePath, canvasPoint, radius)
            if (nodeHit) {
                if ((e.metaKey || e.ctrlKey) && activePathNodeId === nodeHit.nodeId) {
                    updatePath(activePathId, (path) => {
                        const node = path.nodes.find((candidate) => candidate.id === nodeHit.nodeId)
                        if (!node) return path
                        return setNodeType(path, nodeHit.nodeId, node.type === 'smooth' ? 'corner' : 'smooth')
                    }, true)
                    return
                }

                setActivePathNodeId(nodeHit.nodeId)
                setDragState({
                    kind: 'node',
                    pathId: activePathId,
                    nodeId: nodeHit.nodeId,
                    basePath: editableActivePath,
                    commitHistory: true
                })
                return
            }

            const segmentHit = hitTestSegments(
                editableActivePath,
                canvasPoint,
                radius,
                1 / Math.max(zoomLevel, 0.001),
                flatSegments
            )

            if (segmentHit) {
                const inserted = insertNodeOnSegment(editableActivePath, segmentHit.segmentIndex, segmentHit.t)
                if (inserted.nodeId) {
                    setActivePathNodeId(inserted.nodeId)
                    updatePath(activePathId, () => inserted.path, true)
                }
                return
            }

            setActivePathNodeId(null)
            return
        }

        if (!editableActivePath || editableActivePath.closed || !activePathId) {
            const newPathId = createPath()
            const node = createPathNode(canvasPoint.x, canvasPoint.y)

            const now = Date.now()
            const seededPath: VectorPath = {
                id: newPathId,
                name: 'Path',
                visible: true,
                locked: false,
                closed: false,
                nodes: [node],
                createdAt: now,
                updatedAt: now
            }

            updatePath(newPathId, (path) => appendNode(path, node), false)
            setActivePathId(newPathId)
            setActivePathNodeId(node.id)

            if (!isPolygonal) {
                setPreviewPath(seededPath)
                setDragState({
                    kind: 'newNodeHandle',
                    pathId: newPathId,
                    nodeId: node.id,
                    basePath: seededPath,
                    commitHistory: false
                })
            }
            return
        }

        if (isNearStartPoint(editableActivePath, canvasPoint)) {
            updatePath(activePathId, (path) => toggleClosed(path, true), true)
            return
        }

        const node = createPathNode(canvasPoint.x, canvasPoint.y)
        const basePath = appendNode(editableActivePath, node)

        updatePath(activePathId, () => basePath, true)
        setActivePathNodeId(node.id)

        if (!isPolygonal) {
            setPreviewPath(basePath)
            setDragState({
                kind: 'newNodeHandle',
                pathId: activePathId,
                nodeId: node.id,
                basePath,
                commitHistory: false
            })
        }
    }, [
        toCanvas,
        pathMode,
        editableActivePath,
        activePathId,
        zoomLevel,
        flatSegments,
        activePathNodeId,
        updatePath,
        setActivePathNodeId,
        isNearStartPoint,
        createPath,
        setActivePathId,
        isPolygonal
    ])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const canvasPoint = toCanvas(e.clientX, e.clientY)
        setMouseCanvasPos(canvasPoint)

        if (!dragState) return
        e.preventDefault()
        e.stopPropagation()

        let nextPath: VectorPath | null = null

        if (dragState.kind === 'path') {
            const dx = canvasPoint.x - dragState.start.x
            const dy = canvasPoint.y - dragState.start.y
            nextPath = translatePath(dragState.basePath, dx, dy)
        } else if (dragState.kind === 'node') {
            nextPath = moveNode(dragState.basePath, dragState.nodeId, canvasPoint.x, canvasPoint.y)
        } else if (dragState.kind === 'handle') {
            const mirror = !e.altKey
            nextPath = moveHandle(dragState.basePath, dragState.nodeId, dragState.handle, canvasPoint, mirror)
        } else if (dragState.kind === 'newNodeHandle') {
            const smooth = setNodeType(dragState.basePath, dragState.nodeId, 'smooth')
            nextPath = moveHandle(smooth, dragState.nodeId, 'handleOut', canvasPoint, true)
        }

        if (nextPath) {
            setPreviewPath(nextPath)
        }
    }, [dragState, toCanvas])

    const handleMouseUp = useCallback(() => {
        if (dragState && previewPath) {
            updatePath(dragState.pathId, () => previewPath, dragState.commitHistory)
        }

        setDragState(null)
        setPreviewPath(null)
    }, [dragState, previewPath, updatePath])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return
            }

            if (!activePath || activePath.locked) return

            const key = e.key

            if (key === 'Enter' && pathMode === 'design') {
                if (!activePath.closed && activePath.nodes.length >= 3) {
                    e.preventDefault()
                    updatePath(activePath.id, (path) => toggleClosed(path, true), true)
                }
                return
            }

            if (key !== 'Delete' && key !== 'Backspace') return
            e.preventDefault()

            if (pathMode === 'edit' && activePathNodeId) {
                const next = deleteNode(activePath, activePathNodeId)
                if (next.nodes.length === 0) {
                    deletePath(activePath.id)
                    setActivePathNodeId(null)
                    return
                }
                updatePath(activePath.id, () => next, true)
                setActivePathNodeId(next.nodes[next.nodes.length - 1]?.id ?? null)
                return
            }

            if (pathMode === 'design' && !activePath.closed && activePath.nodes.length > 0) {
                const lastNode = activePath.nodes[activePath.nodes.length - 1]
                const next = deleteNode(activePath, lastNode.id)
                if (next.nodes.length === 0) {
                    deletePath(activePath.id)
                    setActivePathNodeId(null)
                    return
                }
                updatePath(activePath.id, () => next, true)
                setActivePathNodeId(next.nodes[next.nodes.length - 1]?.id ?? null)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [activePath, activePathNodeId, pathMode, updatePath, setActivePathNodeId, deletePath])

    const inv = 1 / Math.max(zoomLevel, 0.001)

    const visiblePaths = useMemo(
        () => paths.filter((path) => path.visible),
        [paths]
    )

    const renderRubberBand = () => {
        if (!editableActivePath || editableActivePath.closed || !mouseCanvasPos || dragState || pathMode !== 'design') return null
        if (editableActivePath.nodes.length === 0) return null

        const last = editableActivePath.nodes[editableActivePath.nodes.length - 1]
        return (
            <line
                x1={last.x}
                y1={last.y}
                x2={mouseCanvasPos.x}
                y2={mouseCanvasPos.y}
                stroke="#00a8ff"
                strokeWidth={1 * inv}
                strokeDasharray={`${4 * inv} ${4 * inv}`}
                opacity={0.6}
            />
        )
    }

    const renderCloseIndicator = () => {
        if (!mouseCanvasPos || !editableActivePath || pathMode !== 'design') return null
        if (!isNearStartPoint(editableActivePath, mouseCanvasPos)) return null

        const start = editableActivePath.nodes[0]
        return (
            <circle
                cx={start.x}
                cy={start.y}
                r={8 * inv}
                fill="none"
                stroke="#00ff88"
                strokeWidth={2 * inv}
                opacity={0.8}
            />
        )
    }

    const renderControls = () => {
        if (!editableActivePath || editableActivePath.id !== activePathId) return null

        return editableActivePath.nodes.map((node) => {
            const selected = node.id === activePathNodeId
            return (
                <g key={node.id}>
                    {node.handleIn && (
                        <line
                            x1={node.x}
                            y1={node.y}
                            x2={node.handleIn.x}
                            y2={node.handleIn.y}
                            stroke="#00a8ff"
                            strokeWidth={1 * inv}
                            opacity={0.7}
                        />
                    )}
                    {node.handleOut && (
                        <line
                            x1={node.x}
                            y1={node.y}
                            x2={node.handleOut.x}
                            y2={node.handleOut.y}
                            stroke="#00a8ff"
                            strokeWidth={1 * inv}
                            opacity={0.7}
                        />
                    )}

                    {node.handleIn && <circle cx={node.handleIn.x} cy={node.handleIn.y} r={3 * inv} fill="#00a8ff" />}
                    {node.handleOut && <circle cx={node.handleOut.x} cy={node.handleOut.y} r={3 * inv} fill="#00a8ff" />}

                    <rect
                        x={node.x - 4 * inv}
                        y={node.y - 4 * inv}
                        width={8 * inv}
                        height={8 * inv}
                        fill={selected ? '#00a8ff' : 'white'}
                        stroke="#00a8ff"
                        strokeWidth={1 * inv}
                    />
                </g>
            )
        })
    }

    const getCursor = (): string => {
        if (dragState) {
            if (dragState.kind === 'path') return 'move'
            if (dragState.kind === 'node') return 'move'
            return 'pointer'
        }

        if (pathMode === 'move') return 'move'

        if (pathMode === 'edit' && editableActivePath && mouseCanvasPos) {
            const radius = 8 / Math.max(zoomLevel, 0.001)
            if (hitTestHandles(editableActivePath, mouseCanvasPos, radius)) return 'pointer'
            if (hitTestNodes(editableActivePath, mouseCanvasPos, radius)) return 'move'
            if (hitTestSegments(editableActivePath, mouseCanvasPos, radius, 1 / Math.max(zoomLevel, 0.001), flatSegments)) return 'pointer'
            return 'default'
        }

        if (pathMode === 'design' && editableActivePath && mouseCanvasPos && isNearStartPoint(editableActivePath, mouseCanvasPos)) {
            return 'pointer'
        }

        return 'crosshair'
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'all',
                zIndex: 100,
                cursor: getCursor()
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <svg
                ref={svgRef}
                style={{ width: '100%', height: '100%', overflow: 'visible', position: 'absolute', top: 0, left: 0 }}
            >
                {visiblePaths.map((path) => {
                    const drawn = path.id === activePathId && previewPath ? previewPath : path
                    if (drawn.nodes.length === 0) return null

                    const isActive = path.id === activePathId
                    return (
                        <path
                            key={path.id}
                            d={toPathD(drawn)}
                            fill="none"
                            stroke={isActive ? '#00a8ff' : '#6e7781'}
                            strokeWidth={(isActive ? 2 : 1.4) * inv}
                            opacity={isActive ? 1 : 0.6}
                        />
                    )
                })}

                {renderRubberBand()}
                {renderControls()}
                {renderCloseIndicator()}
            </svg>
        </div>
    )
}
