/**
 * Shape Selection and Transform Overlay
 * 
 * Displays selection handles and allows transformation of shapes.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { getShapeBounds } from '../utils/shapeUtils'
import type { VectorShape, ShapeBounds } from '../types/shape'

interface HandlePosition {
    x: number
    y: number
    cursor: string
    type: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
}

function getHandles(bounds: ShapeBounds, _scale: number): HandlePosition[] {
    const { minX, minY, maxX, maxY } = bounds
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    return [
        { x: minX, y: minY, cursor: 'nwse-resize', type: 'nw' },
        { x: cx, y: minY, cursor: 'ns-resize', type: 'n' },
        { x: maxX, y: minY, cursor: 'nesw-resize', type: 'ne' },
        { x: maxX, y: cy, cursor: 'ew-resize', type: 'e' },
        { x: maxX, y: maxY, cursor: 'nwse-resize', type: 'se' },
        { x: cx, y: maxY, cursor: 'ns-resize', type: 's' },
        { x: minX, y: maxY, cursor: 'nesw-resize', type: 'sw' },
        { x: minX, y: cy, cursor: 'ew-resize', type: 'w' },
    ]
}

interface ShapeOverlayProps {
    zoomLevel: number
}

export default function ShapeOverlay({ zoomLevel }: ShapeOverlayProps) {
    const {
        layers,
        activeLayerId,
        foregroundColor,
    } = useEditor()

    const [dragging, setDragging] = useState<{
        type: 'move' | 'resize'
        handleType?: string
        startX: number
        startY: number
        originalShape: VectorShape
    } | null>(null)

    // Get active shape layer
    const activeLayer = layers.find(l => l.id === activeLayerId)
    const activeShape = activeLayer?.type === 'shape' && activeLayer.shapeData
        ? activeLayer.shapeData.shapes.find(s => s.id === activeLayer.shapeData!.activeShapeId)
        : null

    // Get shape bounds
    const bounds = activeShape ? getShapeBounds(activeShape) : null

    // Handle mouse down on handle (for resize)
    const handleHandleMouseDown = useCallback((e: React.MouseEvent, handleType: string) => {
        e.stopPropagation()
        if (!activeShape) return

        const rect = (e.target as HTMLElement).getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top

        setDragging({
            type: 'resize',
            handleType,
            startX: canvasX,
            startY: canvasY,
            originalShape: activeShape,
        })
    }, [activeShape])

    // Handle mouse move
    useEffect(() => {
        if (!dragging || !activeShape || !activeLayerId) return

        const handleMouseMove = () => {
            // Calculate delta from start position
            // This is simplified - in real implementation we'd need proper coordinate transformation
        }

        const handleMouseUp = () => {
            setDragging(null)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [dragging, activeShape, activeLayerId])

    if (!activeShape || !bounds) return null

    const handles = getHandles(bounds, zoomLevel)
    const handleSize = Math.max(6, 8 / zoomLevel)

    return (
        <div
            className="shape-overlay"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
            }}
        >
            {/* Selection bounding box */}
            <div
                className="shape-selection-box"
                style={{
                    position: 'absolute',
                    left: bounds.minX,
                    top: bounds.minY,
                    width: bounds.width,
                    height: bounds.height,
                    border: `1px solid ${foregroundColor}`,
                    pointerEvents: 'none',
                }}
            />

            {/* Resize handles */}
            {handles.map((handle, i) => (
                <div
                    key={i}
                    className="shape-handle"
                    style={{
                        position: 'absolute',
                        left: handle.x - handleSize / 2,
                        top: handle.y - handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                        backgroundColor: '#ffffff',
                        border: `1px solid ${foregroundColor}`,
                        cursor: handle.cursor,
                        pointerEvents: 'auto',
                    }}
                    onMouseDown={(e) => handleHandleMouseDown(e, handle.type)}
                />
            ))}
        </div>
    )
}