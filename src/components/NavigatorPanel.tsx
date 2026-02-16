import { useRef, useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { ZoomIn, ZoomOut } from 'lucide-react'

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
        ctx.fillStyle = '#111'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw layers
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(navScale, navScale)

        // Draw Checkerboard
        ctx.fillStyle = '#1a1a1a'
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
            const visibleX = -viewTransform.offsetX / viewTransform.scale
            const visibleY = -viewTransform.offsetY / viewTransform.scale
            const visibleW = viewportSize.width / viewTransform.scale
            const visibleH = viewportSize.height / viewTransform.scale

            const navRectX = visibleX * navScale + offsetX
            const navRectY = visibleY * navScale + offsetY
            const navRectW = visibleW * navScale
            const navRectH = visibleH * navScale

            ctx.lineWidth = 1.5
            ctx.strokeStyle = '#3b82f6'
            ctx.strokeRect(navRectX, navRectY, navRectW, navRectH)

            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
            ctx.fillRect(navRectX, navRectY, navRectW, navRectH)
        }

    }, [layers, canvasSize, viewTransform, viewportSize])

    const handleMouseDown = (e: React.MouseEvent) => {
        const metrics = getNavMetrics()
        if (!metrics) return

        const rect = canvasRef.current!.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const { navScale, offsetX, offsetY } = metrics

        const visibleX = -viewTransform.offsetX / viewTransform.scale
        const visibleY = -viewTransform.offsetY / viewTransform.scale
        const visibleW = viewportSize.width / viewTransform.scale
        const visibleH = viewportSize.height / viewTransform.scale

        const navRectX = visibleX * navScale + offsetX
        const navRectY = visibleY * navScale + offsetY
        const navRectW = visibleW * navScale
        const navRectH = visibleH * navScale

        if (x >= navRectX && x <= navRectX + navRectW && y >= navRectY && y <= navRectY + navRectH) {
            setIsDragging(true)
            setDragStart({ x, y })
            setInitialTransform(viewTransform)
        } else {
            const canvasClickX = (x - offsetX) / navScale
            const canvasClickY = (y - offsetY) / navScale

            const targetVisibleX = canvasClickX - (visibleW / 2)
            const targetVisibleY = canvasClickY - (visibleH / 2)

            const newOffsetX = -targetVisibleX * viewTransform.scale
            const newOffsetY = -targetVisibleY * viewTransform.scale

            const newTransform = { ...viewTransform, offsetX: newOffsetX, offsetY: newOffsetY }
            setViewTransform(newTransform)

            setIsDragging(true)
            setDragStart({ x, y })
            setInitialTransform(newTransform)
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

        const deltaCanvasX = dx / navScale
        const deltaCanvasY = dy / navScale

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
        updateZoom(viewTransform.scale * factor)
    }

    const updateZoom = (newScale: number) => {
        // Clamp scale
        const clampedScale = Math.min(Math.max(newScale, 0.01), 32)

        const centerX = viewportSize.width / 2
        const centerY = viewportSize.height / 2

        const canvasX = (centerX - viewTransform.offsetX) / viewTransform.scale
        const canvasY = (centerY - viewTransform.offsetY) / viewTransform.scale

        const newOffsetX = centerX - canvasX * clampedScale
        const newOffsetY = centerY - canvasY * clampedScale

        setViewTransform({
            scale: clampedScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY
        })
    }

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value)
        // Logarithmic scale for better control? Or simple power?
        // Let's use val as power of 2 for smooth exponential zoom
        const newScale = Math.pow(2, val)
        updateZoom(newScale)
    }

    // Convert scale to slider value (log2)
    const sliderValue = Math.log2(viewTransform.scale)

    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className="navigator-panel"
            style={{ width: '100%', height: '100%', position: 'relative', background: '#111', overflow: 'hidden' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
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

            {/* Floating Zoom Controls - Subtle & Hover triggered (Vertical Right) */}
            <div style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 2px',
                zIndex: 10,
                userSelect: 'none',
                opacity: isHovered || isDragging ? 1 : 0,
                pointerEvents: isHovered || isDragging ? 'auto' : 'none',
                transition: 'opacity 0.2s ease-in-out'
            }}>
                <button
                    className="zoom-btn"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 2,
                        borderRadius: 4,
                        filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                    }}
                    onClick={() => handleZoom('in')}
                    title="Zoom In"
                >
                    <ZoomIn size={16} />
                </button>

                <div style={{
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 0'
                }}>
                    <input
                        type="range"
                        min={-6} // 1/64 = ~1.5%
                        max={5}  // 32 = 3200%
                        step={0.01}
                        value={sliderValue}
                        onChange={handleSliderChange}
                        style={{
                            width: 80,
                            height: 4,
                            accentColor: '#3b82f6',
                            cursor: 'pointer',
                            transform: 'rotate(270deg)',
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                        }}
                    />
                </div>

                <button
                    className="zoom-btn"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 2,
                        borderRadius: 4,
                        filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                    }}
                    onClick={() => handleZoom('out')}
                    title="Zoom Out"
                >
                    <ZoomOut size={16} />
                </button>

                <span
                    style={{
                        fontSize: 10,
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontWeight: 500,
                        fontFamily: 'Inter, system-ui',
                        textShadow: '0 0 3px rgba(0,0,0,0.8)',
                        transform: 'rotate(0deg)', // Keep text horizontal
                        marginTop: 4,
                        cursor: 'pointer'
                    }}
                    onDoubleClick={() => updateZoom(1.0)}
                    title="Double-click to reset zoom to 100%"
                >
                    {Math.round(viewTransform.scale * 100)}%
                </span>
            </div>

            <style>{`
                .zoom-btn:hover {
                    color: white !important;
                    background: rgba(255,255,255,0.1) !important;
                }
                .zoom-btn:active {
                    transform: scale(0.9);
                }
                input[type=range] {
                    -webkit-appearance: none;
                    background: transparent;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 12px;
                    width: 12px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    margin-top: -4px;
                    box-shadow: 0 0 4px rgba(0,0,0,0.5);
                    border: 2px solid #1e1e1e;
                }
            `}</style>
        </div>
    )
}
