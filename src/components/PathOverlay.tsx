import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, Path, PathPoint } from './EditorContext'
import type { ToolOptions } from '../App'

interface PathOverlayProps {
    zoomLevel: number
    toolOptions?: ToolOptions
}

export default function PathOverlay({ zoomLevel, toolOptions }: PathOverlayProps) {
    const { activePath, setActivePath, updatePath } = useEditor()
    const containerRef = useRef<HTMLDivElement>(null)

    const [dragState, setDragState] = useState<{
        type: 'point' | 'handleIn' | 'handleOut'
        pointIndex: number
        startX: number
        startY: number
        initialPoint: PathPoint
    } | null>(null)

    // For rubber-band preview + close-path indicator
    const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null)

    // For edit mode: which point is selected
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)

    const pathMode = toolOptions?.pathMode || 'design'

    // Convert screen (client) coordinates to canvas space.
    // Since this overlay sits inside a CSS-transformed parent (.overlays div)
    // that already applies translate+scale, we use getBoundingClientRect on the
    // SVG container to find its screen position, then divide by zoomLevel.
    const toCanvas = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 }
        const rect = containerRef.current.getBoundingClientRect()
        return {
            x: (clientX - rect.left) / zoomLevel,
            y: (clientY - rect.top) / zoomLevel
        }
    }, [zoomLevel])

    // Hit-test: find nearest anchor point within threshold
    const hitTestPoint = useCallback((canvasX: number, canvasY: number): number | null => {
        if (!activePath) return null
        const threshold = 8 / zoomLevel
        for (let i = 0; i < activePath.points.length; i++) {
            const p = activePath.points[i]
            if (Math.hypot(p.x - canvasX, p.y - canvasY) < threshold) {
                return i
            }
        }
        return null
    }, [activePath, zoomLevel])

    // Hit-test: find nearest handle within threshold
    const hitTestHandle = useCallback((canvasX: number, canvasY: number): { pointIndex: number; handle: 'handleIn' | 'handleOut' } | null => {
        if (!activePath) return null
        const threshold = 8 / zoomLevel
        for (let i = 0; i < activePath.points.length; i++) {
            const p = activePath.points[i]
            if (p.handleIn && Math.hypot(p.handleIn.x - canvasX, p.handleIn.y - canvasY) < threshold) {
                return { pointIndex: i, handle: 'handleIn' }
            }
            if (p.handleOut && Math.hypot(p.handleOut.x - canvasX, p.handleOut.y - canvasY) < threshold) {
                return { pointIndex: i, handle: 'handleOut' }
            }
        }
        return null
    }, [activePath, zoomLevel])

    // Check if near start point (for closing)
    const isNearStartPoint = useCallback((canvasX: number, canvasY: number): boolean => {
        if (!activePath || activePath.points.length < 3 || activePath.closed) return false
        const startPoint = activePath.points[0]
        return Math.hypot(startPoint.x - canvasX, startPoint.y - canvasY) < 10 / zoomLevel
    }, [activePath, zoomLevel])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left click
        e.stopPropagation() // Prevent canvas panning/drawing

        const { x, y } = toCanvas(e.clientX, e.clientY)

        // --- EDIT MODE: drag existing points/handles ---
        if (pathMode === 'edit' && activePath) {
            // Check handles first (they're smaller targets, prioritize)
            const handleHit = hitTestHandle(x, y)
            if (handleHit) {
                const pt = activePath.points[handleHit.pointIndex]
                setSelectedPointIndex(handleHit.pointIndex)
                setDragState({
                    type: handleHit.handle,
                    pointIndex: handleHit.pointIndex,
                    startX: x,
                    startY: y,
                    initialPoint: { ...pt }
                })
                return
            }

            // Check anchor points
            const pointHit = hitTestPoint(x, y)
            if (pointHit !== null) {
                const pt = activePath.points[pointHit]
                setSelectedPointIndex(pointHit)
                setDragState({
                    type: 'point',
                    pointIndex: pointHit,
                    startX: x,
                    startY: y,
                    initialPoint: { ...pt }
                })
                return
            }

            // Click on empty space in edit mode → deselect
            setSelectedPointIndex(null)
            return
        }

        // --- MOVE MODE: do nothing for now ---
        if (pathMode === 'move') return

        // --- DESIGN MODE: create new points ---
        if (!activePath) {
            // Start new path
            const newPoint: PathPoint = {
                x, y,
                handleIn: null,
                handleOut: null,
                type: 'corner'
            }
            const newPath: Path = {
                id: Math.random().toString(36).substr(2, 9),
                points: [newPoint],
                closed: false
            }
            setActivePath(newPath)
            setSelectedPointIndex(0)

            // Only start dragging if NOT polygonal
            if (!toolOptions?.pathPolygonal) {
                setDragState({
                    type: 'handleOut',
                    pointIndex: 0,
                    startX: x,
                    startY: y,
                    initialPoint: newPoint
                })
            }
        } else {
            // Add to existing path

            // Check if clicking close to start point to close path
            if (isNearStartPoint(x, y)) {
                updatePath({ ...activePath, closed: true })
                return
            }

            // Otherwise add new point
            const newPoint: PathPoint = {
                x, y,
                handleIn: null,
                handleOut: null,
                type: 'corner'
            }
            const newPath = {
                ...activePath,
                points: [...activePath.points, newPoint]
            }
            updatePath(newPath)
            setSelectedPointIndex(newPath.points.length - 1)

            // Start dragging handleOut (unless polygonal)
            if (!toolOptions?.pathPolygonal) {
                setDragState({
                    type: 'handleOut',
                    pointIndex: newPath.points.length - 1,
                    startX: x,
                    startY: y,
                    initialPoint: newPoint
                })
            }
        }
    }, [activePath, setActivePath, updatePath, toCanvas, zoomLevel, pathMode, hitTestPoint, hitTestHandle, isNearStartPoint, toolOptions?.pathPolygonal])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const { x, y } = toCanvas(e.clientX, e.clientY)

        // Always track mouse position for rubber band + close indicator
        setMouseCanvasPos({ x, y })

        if (!dragState || !activePath) return
        e.stopPropagation()
        e.preventDefault()

        const dx = x - dragState.startX
        const dy = y - dragState.startY

        if (dragState.type === 'handleOut') {
            // Polygonal mode blocks handle creation
            if (toolOptions?.pathPolygonal) return

            // Dragging the "out" handle — creates a smooth point
            const handleX = dragState.initialPoint.x + dx
            const handleY = dragState.initialPoint.y + dy
            const handleInX = dragState.initialPoint.x - dx
            const handleInY = dragState.initialPoint.y - dy

            const updatedPoint: PathPoint = {
                ...activePath.points[dragState.pointIndex],
                type: 'smooth',
                handleOut: { x: handleX, y: handleY },
                handleIn: { x: handleInX, y: handleInY }
            }

            const newPoints = [...activePath.points]
            newPoints[dragState.pointIndex] = updatedPoint
            updatePath({ ...activePath, points: newPoints })
        } else if (dragState.type === 'handleIn') {
            // Dragging the "in" handle
            const pt = dragState.initialPoint
            const handleInX = (pt.handleIn?.x ?? pt.x) + dx
            const handleInY = (pt.handleIn?.y ?? pt.y) + dy

            const updatedPoint: PathPoint = {
                ...activePath.points[dragState.pointIndex],
                handleIn: { x: handleInX, y: handleInY }
            }

            // For smooth points, mirror the opposite handle
            if (updatedPoint.type === 'smooth') {
                const mirrorDx = handleInX - updatedPoint.x
                const mirrorDy = handleInY - updatedPoint.y
                updatedPoint.handleOut = { x: updatedPoint.x - mirrorDx, y: updatedPoint.y - mirrorDy }
            }

            const newPoints = [...activePath.points]
            newPoints[dragState.pointIndex] = updatedPoint
            updatePath({ ...activePath, points: newPoints })
        } else if (dragState.type === 'point') {
            // Dragging an anchor point — move it and its handles
            const pt = dragState.initialPoint
            const newX = pt.x + dx
            const newY = pt.y + dy

            const updatedPoint: PathPoint = {
                ...activePath.points[dragState.pointIndex],
                x: newX,
                y: newY,
            }

            // Shift handles along with the point
            if (pt.handleIn) {
                updatedPoint.handleIn = {
                    x: pt.handleIn.x + dx,
                    y: pt.handleIn.y + dy
                }
            }
            if (pt.handleOut) {
                updatedPoint.handleOut = {
                    x: pt.handleOut.x + dx,
                    y: pt.handleOut.y + dy
                }
            }

            const newPoints = [...activePath.points]
            newPoints[dragState.pointIndex] = updatedPoint
            updatePath({ ...activePath, points: newPoints })
        }
    }, [dragState, activePath, updatePath, toCanvas, toolOptions?.pathPolygonal])

    const handleMouseUp = useCallback(() => {
        setDragState(null)
    }, [])

    // Keyboard listener for deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activePath) return

            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Don't intercept if user is typing in an input
                if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
                e.preventDefault()

                if (pathMode === 'edit' && selectedPointIndex !== null && activePath.points.length > 1) {
                    // Delete selected point
                    const newPoints = activePath.points.filter((_, i) => i !== selectedPointIndex)
                    updatePath({ ...activePath, points: newPoints, closed: newPoints.length < 3 ? false : activePath.closed })
                    setSelectedPointIndex(null)
                } else if (activePath.points.length > 1) {
                    // Remove last point
                    const newPoints = activePath.points.slice(0, -1)
                    updatePath({ ...activePath, points: newPoints, closed: false })
                    setSelectedPointIndex(newPoints.length - 1)
                } else {
                    // Only one point left — clear the path
                    setActivePath(null)
                    setSelectedPointIndex(null)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activePath, pathMode, selectedPointIndex, updatePath, setActivePath])

    // Inverse scale factor for constant-size UI elements
    const inv = 1 / zoomLevel

    // Render path segments
    const renderPath = () => {
        if (!activePath || activePath.points.length === 0) return null

        let d = `M ${activePath.points[0].x} ${activePath.points[0].y}`

        for (let i = 1; i < activePath.points.length; i++) {
            const p1 = activePath.points[i - 1]
            const p2 = activePath.points[i]

            if (p1.handleOut && p2.handleIn) {
                d += ` C ${p1.handleOut.x} ${p1.handleOut.y} ${p2.handleIn.x} ${p2.handleIn.y} ${p2.x} ${p2.y}`
            } else if (p1.handleOut) {
                d += ` Q ${p1.handleOut.x} ${p1.handleOut.y} ${p2.x} ${p2.y}`
            } else if (p2.handleIn) {
                d += ` Q ${p2.handleIn.x} ${p2.handleIn.y} ${p2.x} ${p2.y}`
            } else {
                d += ` L ${p2.x} ${p2.y}`
            }
        }

        if (activePath.closed) {
            const start = activePath.points[0]
            const end = activePath.points[activePath.points.length - 1]
            if (end.handleOut && start.handleIn) {
                d += ` C ${end.handleOut.x} ${end.handleOut.y} ${start.handleIn.x} ${start.handleIn.y} ${start.x} ${start.y}`
            } else {
                d += ` L ${start.x} ${start.y} Z`
            }
        }

        return <path d={d} fill="none" stroke="#00a8ff" strokeWidth={2 * inv} />
    }

    // Render rubber-band preview line
    const renderRubberBand = () => {
        if (!activePath || activePath.closed || !mouseCanvasPos || dragState) return null
        if (pathMode !== 'design') return null
        if (activePath.points.length === 0) return null

        const lastPt = activePath.points[activePath.points.length - 1]

        return (
            <line
                x1={lastPt.x} y1={lastPt.y}
                x2={mouseCanvasPos.x} y2={mouseCanvasPos.y}
                stroke="#00a8ff"
                strokeWidth={1 * inv}
                strokeDasharray={`${4 * inv} ${4 * inv}`}
                opacity={0.6}
            />
        )
    }

    // Render controls (anchors, handles)
    const renderControls = () => {
        if (!activePath) return null
        return activePath.points.map((p, i) => {
            const isSelected = i === selectedPointIndex

            return (
                <g key={i}>
                    {/* Handle lines */}
                    {p.handleIn && (
                        <line x1={p.x} y1={p.y} x2={p.handleIn.x} y2={p.handleIn.y} stroke="#00a8ff" strokeWidth={1 * inv} opacity={0.7} />
                    )}
                    {p.handleOut && (
                        <line x1={p.x} y1={p.y} x2={p.handleOut.x} y2={p.handleOut.y} stroke="#00a8ff" strokeWidth={1 * inv} opacity={0.7} />
                    )}

                    {/* Handle dots */}
                    {p.handleIn && (
                        <circle
                            cx={p.handleIn.x} cy={p.handleIn.y} r={3 * inv}
                            fill="#00a8ff"
                            style={{ cursor: pathMode === 'edit' ? 'pointer' : 'default' }}
                        />
                    )}
                    {p.handleOut && (
                        <circle
                            cx={p.handleOut.x} cy={p.handleOut.y} r={3 * inv}
                            fill="#00a8ff"
                            style={{ cursor: pathMode === 'edit' ? 'pointer' : 'default' }}
                        />
                    )}

                    {/* Anchor point */}
                    <rect
                        x={p.x - 4 * inv}
                        y={p.y - 4 * inv}
                        width={8 * inv}
                        height={8 * inv}
                        fill={isSelected ? '#00a8ff' : 'white'}
                        stroke="#00a8ff"
                        strokeWidth={1 * inv}
                        style={{ cursor: pathMode === 'edit' ? 'move' : 'default' }}
                    />
                </g>
            )
        })
    }

    // Render close-path indicator
    const renderCloseIndicator = () => {
        if (!mouseCanvasPos || !activePath || activePath.closed || activePath.points.length < 3) return null
        if (pathMode !== 'design') return null
        if (!isNearStartPoint(mouseCanvasPos.x, mouseCanvasPos.y)) return null

        const start = activePath.points[0]
        return (
            <circle
                cx={start.x} cy={start.y} r={8 * inv}
                fill="none"
                stroke="#00ff88"
                strokeWidth={2 * inv}
                opacity={0.8}
            />
        )
    }

    // Determine cursor based on context
    const getCursor = (): string => {
        if (pathMode === 'edit') {
            if (mouseCanvasPos) {
                if (hitTestHandle(mouseCanvasPos.x, mouseCanvasPos.y)) return 'pointer'
                if (hitTestPoint(mouseCanvasPos.x, mouseCanvasPos.y) !== null) return 'move'
            }
            return 'default'
        }
        if (pathMode === 'design' && mouseCanvasPos && isNearStartPoint(mouseCanvasPos.x, mouseCanvasPos.y)) {
            return 'pointer'
        }
        return 'crosshair'
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'all',
                zIndex: 100,
                cursor: getCursor()
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <svg
                style={{ width: '100%', height: '100%', overflow: 'visible', position: 'absolute', top: 0, left: 0 }}
            >
                {/* No extra <g> transform — parent CSS handles translate+scale */}
                {renderPath()}
                {renderRubberBand()}
                {renderControls()}
                {renderCloseIndicator()}
            </svg>
        </div>
    )
}
