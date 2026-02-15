import React, { useState, useCallback } from 'react'
import { useEditor, Path, PathPoint } from './EditorContext'
import type { ToolOptions } from '../App'

interface PathOverlayProps {
    scale: number
    offsetX: number
    offsetY: number
    toolOptions?: ToolOptions
}

export default function PathOverlay({ scale, offsetX, offsetY, toolOptions }: PathOverlayProps) {
    const { activePath, setActivePath, updatePath } = useEditor()
    const [dragState, setDragState] = useState<{
        type: 'point' | 'handleIn' | 'handleOut'
        pointIndex: number
        startX: number
        startY: number
        initialPoint: PathPoint
    } | null>(null)

    // Helper to transform screen to canvas coordinates
    const toCanvas = useCallback((clientX: number, clientY: number) => {
        // Adjust for canvas offset and scale
        // screenX = canvasX * scale + offsetX
        // canvasX = (screenX - offsetX) / scale
        return {
            x: (clientX - offsetX) / scale,
            y: (clientY - offsetY) / scale
        }
    }, [scale, offsetX, offsetY])



    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left click
        e.stopPropagation() // Prevent canvas panning/drawing

        const { x, y } = toCanvas(e.clientX, e.clientY)

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

            // Only start dragging if NOT polygonal and NOT in move mode
            if (!toolOptions?.pathPolygonal && toolOptions?.pathMode === 'design') {
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
            if (activePath.points.length > 2 && !activePath.closed) {
                const startPoint = activePath.points[0]
                const dist = Math.hypot(startPoint.x - x, startPoint.y - y)
                if (dist < 10 / scale) { // 10px tolerance
                    updatePath({ ...activePath, closed: true })
                    return
                }
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

            // Start dragging handleOut
            setDragState({
                type: 'handleOut',
                pointIndex: newPath.points.length - 1,
                startX: x,
                startY: y,
                initialPoint: newPoint
            })
        }
    }, [activePath, setActivePath, updatePath, toCanvas, scale])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragState || !activePath) return
        e.stopPropagation()
        e.preventDefault()

        const { x, y } = toCanvas(e.clientX, e.clientY)
        const dx = x - dragState.startX
        const dy = y - dragState.startY

        if (dragState.type === 'handleOut') {
            // If polygonal mode is active, prevent creating handles
            if (toolOptions?.pathPolygonal) return

            // We are dragging the "out" handle of the current point.
            // This turns the point into a smooth point.
            // The "in" handle should mirror it (symmetric).

            // Handle position relative to anchor
            const handleX = dragState.initialPoint.x + dx
            const handleY = dragState.initialPoint.y + dy

            // Mirror for handleIn (relative: -dx, -dy)
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
        }
        // TODO: Handle moving points or handles later (Phase 3)
    }, [dragState, activePath, updatePath, toCanvas])

    const handleMouseUp = useCallback(() => {
        setDragState(null)
    }, [])

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
                // p1 has out, p2 is corner
                d += ` Q ${p1.handleOut.x} ${p1.handleOut.y} ${p2.x} ${p2.y}`
            } else if (p2.handleIn) {
                // p1 is corner, p2 has in
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

        return <path d={d} fill="none" stroke="#00a8ff" strokeWidth={2 / scale} />
    }

    // Render controls
    const renderControls = () => {
        if (!activePath) return null
        return activePath.points.map((p, i) => {
            // Only show handles for selected point (or last point during creation)
            // For now, simplify visual: show all handles? Or just active?
            // Photoshop shows handles for selected anchor.
            // During creation, we are "selecting" the new point.

            // Let's show all for now for debugging/MVP
            return (
                <g key={i}>
                    {/* Handles lines */}
                    {p.handleIn && (
                        <line x1={p.x} y1={p.y} x2={p.handleIn.x} y2={p.handleIn.y} stroke="#00a8ff" strokeWidth={1 / scale} />
                    )}
                    {p.handleOut && (
                        <line x1={p.x} y1={p.y} x2={p.handleOut.x} y2={p.handleOut.y} stroke="#00a8ff" strokeWidth={1 / scale} />
                    )}

                    {/* Handle Dots */}
                    {p.handleIn && <circle cx={p.handleIn.x} cy={p.handleIn.y} r={3 / scale} fill="#00a8ff" />}
                    {p.handleOut && <circle cx={p.handleOut.x} cy={p.handleOut.y} r={3 / scale} fill="#00a8ff" />}

                    {/* Anchor Point */}
                    <rect
                        x={p.x - 4 / scale}
                        y={p.y - 4 / scale}
                        width={8 / scale}
                        height={8 / scale}
                        fill="white"
                        stroke="#00a8ff"
                        strokeWidth={1 / scale}
                    />
                </g>
            )
        })
    }

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'all', // Capture all events for the pen tool
            zIndex: 100
        }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${100 / scale} ${100 / scale}`}>
                {/* 
                    Wait, SVG viewBox/scaling is tricky if we want to match CSS pixels exactly.
                    Easiest to just map coordinates to screen space in render?
                    Or use a transform on the group? 
                 */}
                <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
                    {renderPath()}
                    {renderControls()}
                </g>
            </svg>
        </div>
    )
}
