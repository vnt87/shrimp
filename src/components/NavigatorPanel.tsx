import { useRef, useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { Minus, Plus } from 'lucide-react'

export default function NavigatorPanel() {
    const { canvasSize, layers, viewTransform, setViewTransform, viewportSize } = useEditor()
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Local state for drag interaction
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null)
    const [initialTransform, setInitialTransform] = useState(viewTransform)

    // Calculate navigator metrics
    const getNavMetrics = () => {
        const canvas = canvasRef.current
        if (!canvas) return null

        const scaleX = canvas.width / canvasSize.width
        const scaleY = canvas.height / canvasSize.height
        const navScale = Math.min(scaleX, scaleY)

        const offsetX = (canvas.width - canvasSize.width * navScale) / 2
        const offsetY = (canvas.height - canvasSize.height * navScale) / 2

        return { navScale, offsetX, offsetY }
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const metrics = getNavMetrics()
        if (!metrics) return
        const { navScale, offsetX, offsetY } = metrics

        // clear
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // bg
        ctx.fillStyle = '#1e1e1e'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw layers
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(navScale, navScale)

        // Draw Checkerboard
        ctx.fillStyle = '#333'
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

        layers.slice().reverse().forEach(layer => {
            if (!layer.visible) return
            if (layer.type === 'layer' && layer.data) {
                ctx.drawImage(layer.data, layer.x, layer.y)
            }
        })

        ctx.restore()

        // Draw Viewport Rect
        if (viewportSize.width > 0 && viewportSize.height > 0) {
            // Viewport in canvas coordinates
            // viewTransform.offsetX/Y is the canvas position relative to viewport origin
            // So visible rect starts at: -offsetX / scale, -offsetY / scale
            const visibleX = -viewTransform.offsetX / viewTransform.scale
            const visibleY = -viewTransform.offsetY / viewTransform.scale
            const visibleW = viewportSize.width / viewTransform.scale
            const visibleH = viewportSize.height / viewTransform.scale

            // Convert to Nav coordinates
            const navRectX = visibleX * navScale + offsetX
            const navRectY = visibleY * navScale + offsetY
            const navRectW = visibleW * navScale
            const navRectH = visibleH * navScale

            ctx.lineWidth = 1
            ctx.strokeStyle = 'red'
            ctx.strokeRect(navRectX, navRectY, navRectW, navRectH)

            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)'
            ctx.fillRect(navRectX, navRectY, navRectW, navRectH)
        }

    }, [layers, canvasSize, viewTransform, viewportSize])

    const handleMouseDown = (e: React.MouseEvent) => {
        const metrics = getNavMetrics()
        if (!metrics) return

        const rect = canvasRef.current!.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Logic: If clicking inside rect, start drag. If outside, jump to pos?
        // User asked for "pan within that small area". 
        // Let's implement jump-to-pos on click, and then drag.

        // Calculate clicked position in Main Canvas Coordinates
        const { navScale, offsetX, offsetY } = metrics

        // Check if inside viewport rect
        const visibleX = -viewTransform.offsetX / viewTransform.scale
        const visibleY = -viewTransform.offsetY / viewTransform.scale
        const visibleW = viewportSize.width / viewTransform.scale
        const visibleH = viewportSize.height / viewTransform.scale

        const navRectX = visibleX * navScale + offsetX
        const navRectY = visibleY * navScale + offsetY
        const navRectW = visibleW * navScale
        const navRectH = visibleH * navScale

        if (x >= navRectX && x <= navRectX + navRectW && y >= navRectY && y <= navRectY + navRectH) {
            // Clicking inside - simple drag
            setIsDragging(true)
            setDragStart({ x, y })
            setInitialTransform(viewTransform)
        } else {
            // Clicking outside - jump center to click
            const canvasClickX = (x - offsetX) / navScale
            const canvasClickY = (y - offsetY) / navScale

            // Center viewport on click
            // Target visible center = canvasClickX, canvasClickY
            // Target visible TopLeft = center - width/2

            const targetVisibleX = canvasClickX - (visibleW / 2)
            const targetVisibleY = canvasClickY - (visibleH / 2)

            // Convert back to transform offset
            // offsetX = -targetVisibleX * scale
            const newOffsetX = -targetVisibleX * viewTransform.scale
            const newOffsetY = -targetVisibleY * viewTransform.scale

            const newTransform = { ...viewTransform, offsetX: newOffsetX, offsetY: newOffsetY }
            setViewTransform(newTransform)

            // Also start dragging immediately from the center
            setIsDragging(true)
            setDragStart({ x, y })
            setInitialTransform(newTransform) // Use the new one as base
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStart) return

        const rect = canvasRef.current!.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const dx = x - dragStart.x
        const dy = y - dragStart.y

        const metrics = getNavMetrics()
        if (!metrics) return
        const { navScale } = metrics

        // Convert deltaNav to deltaCanvas
        // deltaCanvas = deltaNav / navScale
        const deltaCanvasX = dx / navScale
        const deltaCanvasY = dy / navScale

        // Update Transform Offset
        // Changing viewport position by +deltaCanvas means moving canvas by -deltaCanvas * scale
        // Wait.
        // If I move viewport RIGHT (+dx), visible area moves right.
        // Canvas Offset moves LEFT.
        // newOffset = initialOffset - deltaCanvas * scale

        const newOffsetX = initialTransform.offsetX - (deltaCanvasX * initialTransform.scale)
        const newOffsetY = initialTransform.offsetY - (deltaCanvasY * initialTransform.scale)

        setViewTransform({ ...initialTransform, offsetX: newOffsetX, offsetY: newOffsetY })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
        setDragStart(null)
    }

    const handleZoom = (direction: 'in' | 'out') => {
        const factor = direction === 'in' ? 1.2 : 1 / 1.2

        // Zoom towards center of viewport
        const centerX = viewportSize.width / 2
        const centerY = viewportSize.height / 2

        // Calculate canvas point at center of viewport
        const canvasX = (centerX - viewTransform.offsetX) / viewTransform.scale
        const canvasY = (centerY - viewTransform.offsetY) / viewTransform.scale

        const newScale = viewTransform.scale * factor

        // New offset to keep canvasX, canvasY at center
        // center = offset + point * newScale
        // offset = center - point * newScale

        const newOffsetX = centerX - canvasX * newScale
        const newOffsetY = centerY - canvasY * newScale

        setViewTransform({
            scale: newScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY
        })
    }

    return (
        <div className="navigator-panel" style={{ width: '100%', height: '100%', position: 'relative', background: '#111', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    width={200}
                    height={150}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>

            {/* Zoom Controls */}
            <div style={{
                height: 32,
                borderTop: '1px solid var(--border-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                background: 'var(--bg-panel)'
            }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {Math.round(viewTransform.scale * 100)}%
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button
                        className="pref-btn pref-btn-secondary"
                        style={{ width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => handleZoom('out')}
                        title="Zoom Out"
                    >
                        <Minus size={14} />
                    </button>
                    {/* Slider could go here */}
                    <button
                        className="pref-btn pref-btn-secondary"
                        style={{ width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => handleZoom('in')}
                        title="Zoom In"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
