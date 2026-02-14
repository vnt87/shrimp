import React, { useEffect, useRef, useState } from 'react'
import { useEditor } from './EditorContext'

interface CropOverlayProps {
    onCrop: (rect: { x: number; y: number; width: number; height: number }) => void
    onCancel: () => void
    scale: number
    offsetX: number
    offsetY: number
}

export default function CropOverlay({ onCrop, onCancel, scale, offsetX, offsetY }: CropOverlayProps) {
    const { canvasSize } = useEditor()
    const [rect, setRect] = useState({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height })
    const [isDragging, setIsDragging] = useState(false)
    const [dragHandle, setDragHandle] = useState<string | null>(null)
    const dragStart = useRef({ x: 0, y: 0, rectX: 0, rectY: 0, rectW: 0, rectH: 0 })

    // Initialize rect to full canvas
    useEffect(() => {
        setRect({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height })
    }, [canvasSize])

    // Keyboard support - ensure we capture events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                onCrop(rect)
            } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onCancel()
            }
        }
        window.addEventListener('keydown', handleKeyDown, { capture: true })
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }, [rect, onCrop, onCancel])

    const getClientPos = (e: React.MouseEvent) => {
        return { x: e.clientX, y: e.clientY }
    }

    const handleMouseDown = (e: React.MouseEvent, handle: string | null) => {
        e.stopPropagation()
        setIsDragging(true)
        setDragHandle(handle)
        const { x, y } = getClientPos(e)
        dragStart.current = {
            x,
            y,
            rectX: rect.x,
            rectY: rect.y,
            rectW: rect.width,
            rectH: rect.height
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        e.stopPropagation()
        e.preventDefault()

        const { x, y } = getClientPos(e)
        const dx = (x - dragStart.current.x) / scale
        const dy = (y - dragStart.current.y) / scale

        let newX = dragStart.current.rectX
        let newY = dragStart.current.rectY
        let newW = dragStart.current.rectW
        let newH = dragStart.current.rectH

        if (dragHandle === 'move') {
            newX += dx
            newY += dy
        } else if (dragHandle) {
            if (dragHandle.includes('w')) {
                newX += dx
                newW -= dx
            }
            if (dragHandle.includes('e')) {
                newW += dx
            }
            if (dragHandle.includes('n')) {
                newY += dy
                newH -= dy
            }
            if (dragHandle.includes('s')) {
                newH += dy
            }
        }

        // Normalize negative width/height
        if (newW < 0) {
            newX += newW
            newW = Math.abs(newW)
        }
        if (newH < 0) {
            newY += newH
            newH = Math.abs(newH)
        }

        setRect({ x: newX, y: newY, width: newW, height: newH })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
        setDragHandle(null)
    }

    // Screen coordinates
    const screenX = rect.x * scale + offsetX
    const screenY = rect.y * scale + offsetY
    const screenW = rect.width * scale
    const screenH = rect.height * scale

    return (
        <div
            className="crop-overlay-container"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Dimmed Background - utilizing SVG mask for complex shape (rectangle with hole) */}
            <svg width="100%" height="100%" style={{ position: 'absolute', pointerEvents: 'none' }}>
                <defs>
                    <mask id="crop-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect x={screenX} y={screenY} width={screenW} height={screenH} fill="black" />
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
            </svg>

            {/* Crop Rectangle */}
            <div
                className="crop-rect"
                style={{
                    position: 'absolute',
                    left: screenX,
                    top: screenY,
                    width: screenW,
                    height: screenH,
                    border: '1px solid white',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                    pointerEvents: 'auto',
                    cursor: 'move'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
                {/* Grid Lines (Rule of Thirds) */}
                <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.3)' }} />

                {/* Handles */}
                {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map(h => (
                    <div
                        key={h}
                        className={`crop-handle ${h}`}
                        style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            backgroundColor: 'white',
                            border: '1px solid black',
                            cursor: `${h}-resize`,
                            ...getHandleStyle(h)
                        }}
                        onMouseDown={(e) => handleMouseDown(e, h)}
                    />
                ))}
            </div>

            {/* Actions Bar */}
            <div style={{
                position: 'absolute',
                left: screenX,
                top: screenY + screenH + 10,
                display: 'flex',
                gap: 8,
                pointerEvents: 'auto'
            }}>
                <button
                    onClick={() => onCrop(rect)}
                    className="pref-btn pref-btn-primary"
                >
                    Crop (Enter)
                </button>
                <button
                    onClick={onCancel}
                    className="pref-btn pref-btn-secondary"
                >
                    Cancel (Esc)
                </button>
            </div>
        </div>
    )
}

function getHandleStyle(pos: string): React.CSSProperties {
    const style: React.CSSProperties = {}
    if (pos.includes('n')) style.top = -5
    if (pos.includes('s')) style.bottom = -5
    if (pos.includes('w')) style.left = -5
    if (pos.includes('e')) style.right = -5
    if (pos === 'n' || pos === 's') { style.left = '50%'; style.marginLeft = -5 }
    if (pos === 'w' || pos === 'e') { style.top = '50%'; style.marginTop = -5 }
    return style
}
