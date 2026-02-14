import React, { useEffect, useRef, useState } from 'react'
import { useEditor } from './EditorContext'

import type { ToolOptions } from '../App'

interface CropOverlayProps {
    onCrop: (rect: { x: number; y: number; width: number; height: number }) => void
    onCancel: () => void
    scale: number
    offsetX: number
    offsetY: number
    toolOptions?: ToolOptions
}

export default function CropOverlay({ onCrop, onCancel, scale, offsetX, offsetY, toolOptions }: CropOverlayProps) {
    const { canvasSize } = useEditor()
    // Initialize with full canvas if no interaction yet? 
    // GIMP/Photoshop usually start with full selection handles.
    const [rect, setRect] = useState({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height })
    const [isDragging, setIsDragging] = useState(false)
    const [dragHandle, setDragHandle] = useState<string | null>(null)
    const dragStart = useRef({ x: 0, y: 0, rectX: 0, rectY: 0, rectW: 0, rectH: 0 })

    // Reset rect when canvas size changes (only if not already modified? mostly just init)
    useEffect(() => {
        // If we want to start fresh every time tool is selected, this is fine.
        // But if we want to remember previous crop, we might need state in parent.
        // For now, reset to full canvas is standard.
        setRect({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height })
    }, [canvasSize.width, canvasSize.height])

    // Keyboard support
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
            // Corner handles
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

            // Aspect Ratio Constraint
            if (toolOptions?.cropFixedRatio && toolOptions.cropAspectRatio) {
                const targetRatio = toolOptions.cropAspectRatio
                // Simple constraint: Adjust the non-dominant axis or based on handle?
                // For corner dragging, we usually preserve ratio.

                // If dragging a corner, adjust W or H to match ratio.
                // If dragging 'se', current W/H. 
                // We need to decide which dimension is "master".
                // Usually take the larger change or just width?

                // Let's force H based on W for simplicity in this iteration, 
                // or check which component of drag is larger.

                // Better approach:
                // If 'e' or 'w' involved, W is primary.
                // If 'n' or 's' involved (and not corners?), H is primary.
                // For corners, it's ambiguous.

                // Implementation: Recalculate based on Width

                // We need to apply this to newH, and potentially adjust newY if 'n' is involved.
                // This gets complex with negative usage.

                // Simplified: Just set H = W / ratio
                // But we need to respect the anchor point (which is opposite handle).

                // Let's use a simplified aspect ratio enforcement:
                if (dragHandle.length === 2) { // Corner
                    // Adjust height to match width * ratio? No, H = W / ratio
                    const signW = Math.sign(newW) || 1
                    const signH = Math.sign(newH) || 1

                    // We use the width to determine height
                    const absW = Math.abs(newW)
                    const absH = absW / targetRatio

                    newW = absW * signW
                    newH = absH * signH

                    // If we were dragging 'n', we need to update Y because H changed
                    if (dragHandle.includes('n')) {
                        // newY was originalY + dy. 
                        // But since H is derived from W, we need anchor at Bottom.
                        // Anchor Y = originalY + originalH
                        // newY = AnchorY - newH
                        const anchorY = dragStart.current.rectY + dragStart.current.rectH
                        newY = anchorY - newH
                    }
                    // If we were dragging 'w', we need to update X?
                    // No, W was calculated from dx, so X is already correct (newX = startX + dx).
                }
            }
        }

        // Normalize negative width/height (flip rect if dragged past origin)
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

    // Highlight Opacity
    const dimOpacity = toolOptions?.cropHighlightOpacity ? toolOptions.cropHighlightOpacity / 100 : 0.5

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
                <rect x="0" y="0" width="100%" height="100%" fill={`rgba(0,0,0,${dimOpacity})`} mask="url(#crop-mask)" />
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
                {/* Guidelines */}
                {toolOptions?.cropGuides === 'center' && (
                    <>
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.5)' }} />
                    </>
                )}
                {toolOptions?.cropGuides === 'thirds' && (
                    <>
                        <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
                        <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
                        <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.5)' }} />
                        <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.5)' }} />
                    </>
                )}
                {toolOptions?.cropGuides === 'fifth' && (
                    <>
                        {[20, 40, 60, 80].map(p => (
                            <React.Fragment key={p}>
                                <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.3)' }} />
                                <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.3)' }} />
                            </React.Fragment>
                        ))}
                    </>
                )}

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

            {/* Info Tooltip */}
            <div style={{
                position: 'absolute',
                left: screenX,
                top: screenY - 25,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '2px 4px',
                fontSize: 10,
                borderRadius: 2,
                pointerEvents: 'none'
            }}>
                {Math.round(rect.width)} x {Math.round(rect.height)}
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
