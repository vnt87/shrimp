import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Application, extend, useApplication } from '@pixi/react'
import { Container, Sprite, Graphics } from 'pixi.js'
import EmptyState from './EmptyState'
import { useEditor } from './EditorContext'
import PixiLayerSprite from './PixiLayerSprite'
import SelectionOverlay from './SelectionOverlay'

// Register Pixi components for @pixi/react
extend({ Container, Sprite, Graphics })

interface CanvasTransform {
    offsetX: number
    offsetY: number
    scale: number
}

function Ruler({
    orientation,
    transform,
}: {
    orientation: 'horizontal' | 'vertical'
    transform: CanvasTransform
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [, setTick] = useState(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !canvas.parentElement) return

        const draw = () => {
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const dpr = window.devicePixelRatio || 1
            const isHorizontal = orientation === 'horizontal'
            const parent = canvas.parentElement!

            if (isHorizontal) {
                canvas.width = parent.clientWidth * dpr
                canvas.height = 16 * dpr
                canvas.style.width = `${parent.clientWidth}px`
                canvas.style.height = '16px'
            } else {
                canvas.width = 16 * dpr
                canvas.height = parent.clientHeight * dpr
                canvas.style.width = '16px'
                canvas.style.height = `${parent.clientHeight}px`
            }

            ctx.scale(dpr, dpr)
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            const size = isHorizontal ? parent.clientWidth : parent.clientHeight
            const offset = isHorizontal ? transform.offsetX : transform.offsetY
            const scale = transform.scale

            // Calculate ruler step based on zoom level
            let step = 100
            if (scale < 0.25) step = 500
            else if (scale < 0.5) step = 200
            else if (scale > 4) step = 25
            else if (scale > 2) step = 50

            const smallStep = step / 10

            // Calculate visible range in image coordinates
            const startCoord = -offset / scale
            const endCoord = (size - offset) / scale

            const firstMajor = Math.floor(startCoord / step) * step
            const lastMajor = Math.ceil(endCoord / step) * step

            for (let coord = firstMajor; coord <= lastMajor; coord += smallStep) {
                const screenPos = coord * scale + offset
                if (screenPos < 0 || screenPos > size) continue

                const isMajor = Math.abs(coord % step) < 0.01
                const isMedium = Math.abs(coord % (step / 2)) < 0.01

                ctx.strokeStyle = isMajor ? '#949494' : '#6e6e6e'
                ctx.lineWidth = 1

                const tickLen = isMajor ? 12 : isMedium ? 8 : 4

                ctx.beginPath()
                if (isHorizontal) {
                    ctx.moveTo(screenPos, 16)
                    ctx.lineTo(screenPos, 16 - tickLen)
                } else {
                    ctx.moveTo(16, screenPos)
                    ctx.lineTo(16 - tickLen, screenPos)
                }
                ctx.stroke()

                if (isMajor) {
                    ctx.fillStyle = '#6e6e6e'
                    ctx.font = '8px "JetBrains Mono", monospace'
                    const label = String(Math.round(coord))
                    if (isHorizontal) {
                        ctx.fillText(label, screenPos + 2, 8)
                    } else {
                        ctx.save()
                        ctx.translate(3, screenPos + 2)
                        ctx.rotate(-Math.PI / 2)
                        ctx.fillText(label, 0, 0)
                        ctx.restore()
                    }
                }
            }
        }

        draw()

        const ro = new ResizeObserver(() => {
            draw()
            setTick((t) => t + 1)
        })
        ro.observe(canvas.parentElement)
        return () => ro.disconnect()
    }, [orientation, transform])

    return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

/**
 * Inner Pixi scene that renders layers and selection overlay.
 * Must be a child of <Application> to use useApplication().
 */
function PixiScene({
    transform,
}: {
    transform: CanvasTransform
}) {
    const { layers, canvasSize, selection } = useEditor()
    const { app } = useApplication()

    // Draw the checkerboard background pattern via <pixiGraphics>
    const drawBackground = useCallback(
        (g: Graphics) => {
            g.clear()
            const checkSize = 10
            const cols = Math.ceil(canvasSize.width / checkSize)
            const rows = Math.ceil(canvasSize.height / checkSize)

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const isLight = (row + col) % 2 === 0
                    g.setFillStyle({ color: isLight ? 0xe0e0e0 : 0xcccccc })
                    g.rect(col * checkSize, row * checkSize, checkSize, checkSize)
                    g.fill()
                }
            }
        },
        [canvasSize]
    )

    // Resize the renderer when the app's canvas parent changes
    useEffect(() => {
        if (app?.renderer) {
            app.renderer.resize(
                app.canvas.parentElement?.clientWidth || canvasSize.width,
                app.canvas.parentElement?.clientHeight || canvasSize.height
            )
        }
    }, [app, canvasSize])

    return (
        <pixiContainer
            x={transform.offsetX}
            y={transform.offsetY}
            scale={transform.scale}
        >
            {/* Checkerboard background */}
            <pixiGraphics draw={drawBackground} />

            {/* GPU-rendered layers */}
            {layers.slice().reverse().map(layer => (
                <PixiLayerSprite key={layer.id} layer={layer} />
            ))}

            {/* GPU-rendered selection overlay */}
            {selection && selection.width > 0 && selection.height > 0 && (
                <SelectionOverlay selection={selection} />
            )}
        </pixiContainer>
    )
}


export default function Canvas({
    onCursorMove,
    activeTool = 'move',
}: {
    onCursorMove?: (pos: { x: number; y: number } | null) => void
    activeTool?: string
}) {
    const {
        layers,
        activeLayerId,
        canvasSize,
        setCanvasSize,
        addLayer,
        updateLayerData,
        updateLayerPosition,
        selection,
        setSelection,
        closeImage
    } = useEditor()

    const [transform, setTransform] = useState<CanvasTransform>({
        offsetX: 0,
        offsetY: 0,
        scale: 1,
    })

    // Viewport state
    const [isPanning, setIsPanning] = useState(false)
    const [isSpaceHeld, setIsSpaceHeld] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0, layerX: 0, layerY: 0 })

    // Selection state
    const isSelecting = useRef(false)
    const selectionStart = useRef({ x: 0, y: 0 })

    const viewportRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fit image/canvas to viewport
    const fitToView = useCallback((w: number, h: number) => {
        const viewport = viewportRef.current
        if (!viewport) return

        const vw = viewport.clientWidth
        const vh = viewport.clientHeight

        const scaleX = vw / w
        const scaleY = vh / h
        const scale = Math.min(scaleX, scaleY, 1) * 0.85

        const offsetX = (vw - w * scale) / 2
        const offsetY = (vh - h * scale) / 2

        setTransform({ offsetX, offsetY, scale })
    }, [])

    const loadImage = useCallback((src: string, name: string) => {
        const img = new window.Image()
        img.onload = () => {
            // If it's the first layer, set canvas size
            if (layers.length === 0) {
                setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight })
                fitToView(img.naturalWidth, img.naturalHeight)
            }

            // Create new layer
            const id = addLayer(name)

            // Draw image to layer's offscreen canvas (CPU side)
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(img, 0, 0)
                updateLayerData(id, canvas)
            }
        }
        img.src = src
    }, [layers.length, addLayer, setCanvasSize, updateLayerData, fitToView])

    const handleLoadSample = useCallback(() => {
        loadImage('/cathedral.jpg', 'cathedral.jpg')
    }, [loadImage])

    const handleOpenFile = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return
            const url = URL.createObjectURL(file)
            loadImage(url, file.name)
        },
        [loadImage]
    )

    const handlePasteClipboard = useCallback(async () => {
        try {
            const items = await navigator.clipboard.read()
            for (const item of items) {
                const imageType = item.types.find((t) => t.startsWith('image/'))
                if (imageType) {
                    const blob = await item.getType(imageType)
                    const url = URL.createObjectURL(blob)
                    loadImage(url, 'Clipboard Image')
                    return
                }
            }
            alert('No image found in clipboard')
        } catch {
            alert('Could not read clipboard.')
        }
    }, [loadImage])

    // Keyboard handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return
            if (e.code === 'Space') {
                e.preventDefault()
                setIsSpaceHeld(true)
            }
            if (e.key === 'Escape') {
                // Clear selection
                setSelection(null)
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpaceHeld(false)
                setIsDragging(false)
                setIsPanning(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [setSelection])

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!viewportRef.current) return

        // Panning (Space held or Middle click)
        if (isSpaceHeld || e.button === 1) {
            e.preventDefault()
            setIsPanning(true)
            setIsDragging(true)
            dragStart.current = {
                x: e.clientX,
                y: e.clientY,
                offsetX: transform.offsetX,
                offsetY: transform.offsetY,
                layerX: 0,
                layerY: 0
            }
            return
        }

        const rect = viewportRef.current.getBoundingClientRect()
        // Coordinates in canvas space
        const canvasX = (e.clientX - rect.left - transform.offsetX) / transform.scale
        const canvasY = (e.clientY - rect.top - transform.offsetY) / transform.scale

        if (activeTool === 'move' && activeLayerId) {
            const layer = layers.find(l => l.id === activeLayerId)
            if (layer) {
                setIsDragging(true)
                dragStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    offsetX: 0,
                    offsetY: 0,
                    layerX: layer.x,
                    layerY: layer.y
                }
            }
        } else if (activeTool === 'rect-select' || activeTool === 'ellipse-select') {
            isSelecting.current = true
            selectionStart.current = { x: canvasX, y: canvasY }
            setSelection({
                type: activeTool === 'rect-select' ? 'rect' : 'ellipse',
                x: canvasX,
                y: canvasY,
                width: 0,
                height: 0
            })
        }

    }, [isSpaceHeld, transform, activeTool, activeLayerId, layers, setSelection])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!viewportRef.current) return

        // Cursor tracking
        const rect = viewportRef.current.getBoundingClientRect()
        const canvasX = (e.clientX - rect.left - transform.offsetX) / transform.scale
        const canvasY = (e.clientY - rect.top - transform.offsetY) / transform.scale

        if (onCursorMove) onCursorMove({ x: Math.round(canvasX), y: Math.round(canvasY) })

        if (isPanning && isDragging) {
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            setTransform(prev => ({
                ...prev,
                offsetX: dragStart.current.offsetX + dx,
                offsetY: dragStart.current.offsetY + dy
            }))
            return
        }

        if (activeTool === 'move' && isDragging && activeLayerId) {
            const dx = (e.clientX - dragStart.current.x) / transform.scale
            const dy = (e.clientY - dragStart.current.y) / transform.scale
            updateLayerPosition(
                activeLayerId,
                dragStart.current.layerX + dx,
                dragStart.current.layerY + dy
            )
        } else if (isSelecting.current) {
            const startX = selectionStart.current.x
            const startY = selectionStart.current.y

            const w = canvasX - startX
            const h = canvasY - startY

            // Normalize to positive width/height
            const x = w < 0 ? canvasX : startX
            const y = h < 0 ? canvasY : startY
            const width = Math.abs(w)
            const height = Math.abs(h)

            setSelection({
                type: activeTool === 'rect-select' ? 'rect' : 'ellipse',
                x,
                y,
                width,
                height
            })
        }

    }, [isPanning, isDragging, activeTool, activeLayerId, transform, onCursorMove, updateLayerPosition, setSelection])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        setIsPanning(false)
        isSelecting.current = false
    }, [])

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (layers.length === 0) return
        e.preventDefault()

        const viewport = viewportRef.current
        if (!viewport) return

        const rect = viewport.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9

        setTransform((prev) => {
            const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.05), 20)
            const newOffsetX = mouseX - (mouseX - prev.offsetX) * (newScale / prev.scale)
            const newOffsetY = mouseY - (mouseY - prev.offsetY) * (newScale / prev.scale)
            return { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale }
        })
    }, [layers.length])

    return (
        <div className="canvas-area">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {layers.length > 0 ? (
                <>
                    <div className="canvas-tabs">
                        <div className="canvas-tab active">
                            <span>Image</span>
                            <div className="tab-close" onClick={closeImage} style={{ cursor: 'pointer' }}>
                                <X size={10} />
                            </div>
                        </div>
                    </div>
                    <div className="canvas-separator" />
                    <div className="canvas-with-rulers">
                        <div className="ruler-corner" />
                        <div className="ruler-horizontal">
                            <Ruler orientation="horizontal" transform={transform} />
                        </div>
                        <div className="ruler-vertical">
                            <Ruler orientation="vertical" transform={transform} />
                        </div>

                        <div
                            ref={viewportRef}
                            className={`canvas-viewport ${isPanning ? 'panning-active' : isSpaceHeld ? 'panning-ready' : ''} ${activeTool === 'move' ? 'cursor-move' : ''} ${activeTool.includes('select') ? 'crosshair' : ''}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            {/* GPU-accelerated Pixi.js Application */}
                            <Application
                                resizeTo={viewportRef as any}
                                background={'#3a3a3a'}
                                antialias
                                autoDensity
                                resolution={window.devicePixelRatio || 1}
                            >
                                <PixiScene transform={transform} />
                            </Application>
                        </div>
                    </div>
                </>
            ) : (
                <EmptyState
                    onLoadSample={handleLoadSample}
                    onOpenFile={handleOpenFile}
                    onPasteClipboard={handlePasteClipboard}
                />
            )}
        </div>
    )
}
