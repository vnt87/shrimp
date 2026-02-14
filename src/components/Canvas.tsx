import { X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Application, extend, useApplication, useTick } from '@pixi/react'
import { Container, Sprite, Graphics } from 'pixi.js'
import EmptyState from './EmptyState'
import { useEditor, type Layer } from './EditorContext'
import PixiLayerSprite from './PixiLayerSprite'
import SelectionOverlay from './SelectionOverlay'
import CropOverlay from './CropOverlay'
import type { ToolOptions } from '../App'

// Register Pixi components for @pixi/react
extend({ Container, Sprite, Graphics })

interface LayerOutlineProps {
    layer: import('./EditorContext').Layer
}

function LayerOutline({ layer }: LayerOutlineProps) {
    const draw = useCallback((g: import('pixi.js').Graphics) => {
        g.clear()
        if (!layer.data) return

        console.log('Drawing outline for layer', layer.id)

        // Draw black border for contrast
        g.lineStyle(4, 0x000000, 1) // thick black outline
        g.drawRect(layer.x, layer.y, layer.data.width, layer.data.height)

        // Draw cyan border
        g.lineStyle(2, 0x00ffff, 1) // cyan inner outline
        g.drawRect(layer.x, layer.y, layer.data.width, layer.data.height)

        // Optional: Corner handles could be added here
    }, [layer.x, layer.y, layer.data])

    return <graphics draw={draw} />
}

interface CanvasTransform {
    offsetX: number
    offsetY: number
    scale: number
}

function Ruler({
    orientation,
    transform,
    onDragStart,
}: {
    orientation: 'horizontal' | 'vertical'
    transform: CanvasTransform
    onDragStart: (e: React.MouseEvent) => void
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

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: orientation === 'horizontal' ? 'ns-resize' : 'ew-resize' }}
            onMouseDown={onDragStart}
        />
    )
}

/**
 * Recursive component to render layers and groups.
 */
function PixiLayerRecursive({ layer }: { layer: import('./EditorContext').Layer }) {
    const { activeLayerId } = useEditor()

    if (!layer.visible) return null

    // For groups, render a Container and recurse
    if (layer.type === 'group') {
        return (
            <pixiContainer
                x={layer.x}
                y={layer.y}
                alpha={layer.opacity / 100}
            >
                {layer.children?.slice().reverse().map(child => (
                    <PixiLayerRecursive key={child.id} layer={child} />
                ))}
            </pixiContainer>
        )
    }

    // For regular layers, render the sprite and optional outline
    return (
        <React.Fragment>
            <PixiLayerSprite layer={layer} />
            {layer.id === activeLayerId && (
                <LayerOutline layer={layer} />
            )}
        </React.Fragment>
    )
}

/**
 * Brush cursor that follows mouse position smoothly using useTick
 */
function BrushCursor({
    cursorRef,
    toolOptions,
    activeTool
}: {
    cursorRef: React.MutableRefObject<{ x: number, y: number }>
    toolOptions?: ToolOptions
    activeTool: string
}) {
    const graphicsRef = useRef<import('pixi.js').Graphics>(null)
    const { brushSize } = toolOptions || { brushSize: 10 }

    useTick(() => {
        if (graphicsRef.current) {
            const { x, y } = cursorRef.current

            // Only show for drawing tools
            const visible = ['brush', 'pencil', 'eraser'].includes(activeTool)
            graphicsRef.current.visible = visible

            if (visible) {
                graphicsRef.current.position.set(x, y)
                graphicsRef.current.clear()
                graphicsRef.current.lineStyle(1, 0xFFFFFF, 0.8) // White outer
                graphicsRef.current.drawCircle(0, 0, brushSize / 2)
                graphicsRef.current.lineStyle(1, 0x000000, 0.5) // Black inner for contrast
                graphicsRef.current.drawCircle(0, 0, (brushSize / 2) - 1)
            }
        }
    })

    return <graphics ref={graphicsRef} draw={() => { }} />
}

/**
 * Inner Pixi scene that renders layers and selection overlay.
 * Must be a child of <Application> to use useApplication().
 */
function PixiScene({
    transform,
    cursorRef,
    toolOptions,
    activeTool
}: {
    transform: CanvasTransform
    cursorRef: React.MutableRefObject<{ x: number, y: number }>
    toolOptions?: ToolOptions
    activeTool: string
}) {
    const { layers, canvasSize, selection } = useEditor()
    const { app } = useApplication()

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
            {/* GPU-rendered layers (recursive) */}
            {layers.slice().reverse().map(layer => (
                <PixiLayerRecursive key={layer.id} layer={layer} />
            ))}

            {/* GPU-rendered selection overlay */}
            {selection && selection.width > 0 && selection.height > 0 && (
                <SelectionOverlay selection={selection} />
            )}

            {/* Brush Cursor Overlay */}
            <BrushCursor cursorRef={cursorRef} toolOptions={toolOptions} activeTool={activeTool} />
        </pixiContainer>
    )
}




export default function Canvas({
    onCursorMove,
    activeTool = 'move',
    onToolChange,
    toolOptions,
}: {
    onCursorMove?: (pos: { x: number; y: number } | null) => void
    activeTool?: string
    onToolChange?: (tool: string) => void
    toolOptions?: ToolOptions
}) {
    const {
        layers,
        activeLayerId,
        setCanvasSize,
        addLayer,
        updateLayerPosition,
        updateLayerData,
        setSelection,
        closeImage,
        undo,
        redo,
        cropCanvas,
        guides,
        addGuide,
        updateGuide,
        removeGuide,
        foregroundColor,
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
    const cursorRef = useRef({ x: 0, y: 0 })

    // Guide dragging state
    const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null)
    const [tempGuide, setTempGuide] = useState<{ orientation: 'horizontal' | 'vertical', pos: number } | null>(null)

    // Selection state
    const isSelecting = useRef(false)
    const selectionStart = useRef({ x: 0, y: 0 })

    const viewportRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Drawing state
    const isDrawing = useRef(false)
    const lastDrawPoint = useRef<{ x: number; y: number } | null>(null)

    // --- Drawing helper: draw stroke segment ---
    const drawStrokeTo = useCallback((canvasX: number, canvasY: number, isFirst: boolean) => {
        if (!activeLayerId) return
        const layer = layers.find((l: Layer) => l.id === activeLayerId)
        if (!layer || !layer.data || layer.locked) return

        const ctx = layer.data.getContext('2d')
        if (!ctx) return

        const size = toolOptions?.brushSize ?? 10
        const opacity = (toolOptions?.brushOpacity ?? 100) / 100
        const hardness = (toolOptions?.brushHardness ?? 100) / 100
        const isEraser = activeTool === 'eraser'
        const isPencil = activeTool === 'pencil'

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : foregroundColor
        ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : foregroundColor
        ctx.lineWidth = size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // For pencil (hard edge), no anti-aliasing tricks
        if (isPencil) {
            ctx.imageSmoothingEnabled = false
        }

        // Apply hardness via shadow (soft brush)
        if (!isPencil && hardness < 1) {
            ctx.shadowBlur = size * (1 - hardness) * 0.5
            ctx.shadowColor = isEraser ? 'rgba(0,0,0,1)' : foregroundColor
        }

        // Adjust coordinates relative to layer position
        const lx = canvasX - layer.x
        const ly = canvasY - layer.y

        if (isFirst || !lastDrawPoint.current) {
            // Single dot
            ctx.beginPath()
            ctx.arc(lx, ly, size / 2, 0, Math.PI * 2)
            ctx.fill()
        } else {
            const prevX = lastDrawPoint.current.x - layer.x
            const prevY = lastDrawPoint.current.y - layer.y
            ctx.beginPath()
            ctx.moveTo(prevX, prevY)
            ctx.lineTo(lx, ly)
            ctx.stroke()
        }

        ctx.restore()
        lastDrawPoint.current = { x: canvasX, y: canvasY }

        // Clone the canvas to trigger React state update
        const newCanvas = document.createElement('canvas')
        newCanvas.width = layer.data.width
        newCanvas.height = layer.data.height
        const newCtx = newCanvas.getContext('2d')
        newCtx?.drawImage(layer.data, 0, 0)
        updateLayerData(activeLayerId, newCanvas)
    }, [activeLayerId, layers, activeTool, toolOptions, foregroundColor, updateLayerData])

    // --- Flood fill (bucket tool) ---
    const floodFill = useCallback((canvasX: number, canvasY: number) => {
        if (!activeLayerId) return
        const layer = layers.find((l: Layer) => l.id === activeLayerId)
        if (!layer || !layer.data || layer.locked) return

        const lx = Math.round(canvasX - layer.x)
        const ly = Math.round(canvasY - layer.y)
        if (lx < 0 || ly < 0 || lx >= layer.data.width || ly >= layer.data.height) return

        const ctx = layer.data.getContext('2d')
        if (!ctx) return

        const imageData = ctx.getImageData(0, 0, layer.data.width, layer.data.height)
        const data = imageData.data
        const w = imageData.width
        const h = imageData.height
        const threshold = toolOptions?.fillThreshold ?? 15

        // Parse fill color
        const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16)
            const g = parseInt(hex.slice(3, 5), 16)
            const b = parseInt(hex.slice(5, 7), 16)
            return [r, g, b, 255]
        }
        const fillColor = hexToRgb(foregroundColor)

        // Get target color
        const idx = (ly * w + lx) * 4
        const targetColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]

        // Check if colors match (within threshold)
        const colorMatch = (i: number) => {
            return (
                Math.abs(data[i] - targetColor[0]) <= threshold &&
                Math.abs(data[i + 1] - targetColor[1]) <= threshold &&
                Math.abs(data[i + 2] - targetColor[2]) <= threshold &&
                Math.abs(data[i + 3] - targetColor[3]) <= threshold
            )
        }

        // Don't fill if target is already fill color
        if (
            targetColor[0] === fillColor[0] &&
            targetColor[1] === fillColor[1] &&
            targetColor[2] === fillColor[2] &&
            targetColor[3] === fillColor[3]
        ) return

        // Scanline flood fill
        const stack: [number, number][] = [[lx, ly]]
        const visited = new Uint8Array(w * h)

        while (stack.length > 0) {
            const [sx, sy] = stack.pop()!
            let x = sx

            // Move to leftmost matching pixel
            while (x > 0 && colorMatch((sy * w + x - 1) * 4) && !visited[sy * w + x - 1]) {
                x--
            }

            let spanAbove = false
            let spanBelow = false

            while (x < w && colorMatch((sy * w + x) * 4) && !visited[sy * w + x]) {
                const pi = (sy * w + x) * 4
                data[pi] = fillColor[0]
                data[pi + 1] = fillColor[1]
                data[pi + 2] = fillColor[2]
                data[pi + 3] = fillColor[3]
                visited[sy * w + x] = 1

                if (sy > 0) {
                    if (colorMatch(((sy - 1) * w + x) * 4) && !visited[(sy - 1) * w + x]) {
                        if (!spanAbove) {
                            stack.push([x, sy - 1])
                            spanAbove = true
                        }
                    } else {
                        spanAbove = false
                    }
                }

                if (sy < h - 1) {
                    if (colorMatch(((sy + 1) * w + x) * 4) && !visited[(sy + 1) * w + x]) {
                        if (!spanBelow) {
                            stack.push([x, sy + 1])
                            spanBelow = true
                        }
                    } else {
                        spanBelow = false
                    }
                }

                x++
            }
        }

        ctx.putImageData(imageData, 0, 0)

        // Clone canvas to trigger update
        const newCanvas = document.createElement('canvas')
        newCanvas.width = layer.data.width
        newCanvas.height = layer.data.height
        const newCtx = newCanvas.getContext('2d')
        newCtx?.drawImage(layer.data, 0, 0)
        updateLayerData(activeLayerId, newCanvas)
    }, [activeLayerId, layers, foregroundColor, toolOptions, updateLayerData])

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
            // Create canvas and draw image
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(img, 0, 0)
            }

            // If it's the first layer, set canvas size
            if (layers.length === 0) {
                setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight })
                fitToView(img.naturalWidth, img.naturalHeight)
            }

            // Create new layer WITH data atomically
            addLayer(name, canvas)
        }
        img.src = src
    }, [layers.length, addLayer, setCanvasSize, fitToView])

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

            // Undo/Redo
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    redo()
                } else {
                    undo()
                }
                return
            }

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
    }, [setSelection, undo, redo])

    // Mouse handlers
    const handleGuideDragStart = (orientation: 'horizontal' | 'vertical') => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setTempGuide({ orientation, pos: orientation === 'horizontal' ? e.clientY : e.clientX })
    }

    const handleExistingGuideDragStart = (id: string) => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDraggingGuideId(id)
    }

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
            setIsDragging(true)
            isSelecting.current = true
            selectionStart.current = { x: canvasX, y: canvasY }
            setSelection({
                type: activeTool === 'rect-select' ? 'rect' : 'ellipse',
                x: canvasX,
                y: canvasY,
                width: 0,
                height: 0
            })
        } else if (activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'eraser') {
            isDrawing.current = true
            lastDrawPoint.current = null
            drawStrokeTo(canvasX, canvasY, true)
        } else if (activeTool === 'bucket') {
            floodFill(canvasX, canvasY)
        }

    }, [isSpaceHeld, transform, activeTool, activeLayerId, layers, setSelection, drawStrokeTo, floodFill])

    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!viewportRef.current) return

        // Cursor tracking
        const rect = viewportRef.current.getBoundingClientRect()
        const canvasX = (e.clientX - rect.left - transform.offsetX) / transform.scale
        const canvasY = (e.clientY - rect.top - transform.offsetY) / transform.scale

        // Update ref for PixiCursor
        cursorRef.current = { x: canvasX, y: canvasY }

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

        // Handle Guide Dragging (New or Existing)
        if (tempGuide || draggingGuideId) {
            const rect = viewportRef.current.getBoundingClientRect()

            if (tempGuide) {
                // We are dragging a NEW guide from the ruler
                const pos = tempGuide.orientation === 'horizontal' ? e.clientY : e.clientX
                setTempGuide({ ...tempGuide, pos })
            }

            if (draggingGuideId) {
                // We are moving an EXISTING guide
                const guide = guides.find(g => g.id === draggingGuideId)
                if (guide) {
                    const clientPos = guide.orientation === 'horizontal' ? e.clientY : e.clientX
                    // Convert client pos back to canvas coordinates
                    const canvasPos = (clientPos - (guide.orientation === 'horizontal' ? rect.top : rect.left) - (guide.orientation === 'horizontal' ? transform.offsetY : transform.offsetX)) / transform.scale
                    updateGuide(draggingGuideId, canvasPos)
                }
            }
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
        } else if (isDrawing.current && (activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'eraser')) {
            drawStrokeTo(canvasX, canvasY, false)
        }

    }, [isPanning, isDragging, activeTool, activeLayerId, transform, onCursorMove, updateLayerPosition, setSelection, tempGuide, draggingGuideId, guides, updateGuide, drawStrokeTo])

    const handleMouseUp = useCallback((e: React.MouseEvent | MouseEvent) => {
        setIsDragging(false)
        setIsPanning(false)
        isSelecting.current = false

        // Finish drawing stroke
        if (isDrawing.current) {
            isDrawing.current = false
            lastDrawPoint.current = null
        }

        // Finish guide dragging
        if (tempGuide && viewportRef.current) {
            const rect = viewportRef.current.getBoundingClientRect()
            // Check if we dropped within the viewport
            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                // Convert to canvas coords
                const clientPos = tempGuide.orientation === 'horizontal' ? e.clientY : e.clientX
                const offset = tempGuide.orientation === 'horizontal' ? transform.offsetY : transform.offsetX
                const viewportStart = tempGuide.orientation === 'horizontal' ? rect.top : rect.left

                const canvasPos = (clientPos - viewportStart - offset) / transform.scale
                addGuide({
                    orientation: tempGuide.orientation,
                    position: canvasPos
                })
            }
            setTempGuide(null)
        }

        if (draggingGuideId && viewportRef.current) {
            const rect = viewportRef.current.getBoundingClientRect()
            // If dropped outside viewport (back to ruler roughly), remove it
            if (
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom
            ) {
                removeGuide(draggingGuideId)
            }
            setDraggingGuideId(null)
        }

    }, [tempGuide, draggingGuideId, transform, addGuide, removeGuide])

    // Global event listeners for dragging
    useEffect(() => {
        if (isDragging || tempGuide || draggingGuideId) {
            const onMove = (e: MouseEvent) => handleMouseMove(e)
            const onUp = (e: MouseEvent) => handleMouseUp(e)

            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
            return () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
            }
        }
    }, [isDragging, tempGuide, draggingGuideId, handleMouseMove, handleMouseUp])

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

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.files) {
            Array.from(e.dataTransfer.files).forEach((file) => {
                if (file.type.startsWith('image/')) {
                    const url = URL.createObjectURL(file)
                    loadImage(url, file.name)
                }
            })
        }
    }, [loadImage])

    return (
        <div
            className="canvas-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
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
                            <Ruler
                                orientation="horizontal"
                                transform={transform}
                                onDragStart={handleGuideDragStart('horizontal')}
                            />
                        </div>
                        <div className="ruler-vertical">
                            <Ruler
                                orientation="vertical"
                                transform={transform}
                                onDragStart={handleGuideDragStart('vertical')}
                            />
                        </div>

                        <div
                            ref={viewportRef}
                            className={`canvas-viewport ${isPanning ? 'panning-active' : isSpaceHeld ? 'panning-ready' : ''} ${activeTool === 'move' ? 'cursor-move' : ''} ${activeTool.includes('select') ? 'crosshair' : ''}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            {/* GPU-accelerated Pixi.js Application */}
                            <Application
                                resizeTo={viewportRef as any}
                                backgroundAlpha={0}
                                antialias
                                autoDensity
                                resolution={window.devicePixelRatio || 1}
                            >
                                <PixiScene
                                    transform={transform}
                                    cursorRef={cursorRef}
                                    toolOptions={toolOptions}
                                    activeTool={activeTool}
                                />
                            </Application>

                            {/* Crop Overlay */}
                            {activeTool === 'crop' && (
                                <CropOverlay
                                    onCrop={(rect) => {
                                        cropCanvas(rect.x, rect.y, rect.width, rect.height)
                                        // Reset to move tool after crop
                                        onToolChange?.('move')
                                    }}
                                    onCancel={() => {
                                        // Reset to move tool on cancel
                                        onToolChange?.('move')
                                    }}
                                    scale={transform.scale}
                                    offsetX={transform.offsetX}
                                    offsetY={transform.offsetY}
                                />
                            )}

                            {/* Render Guides */}
                            {guides.map(guide => {
                                const isHorizontal = guide.orientation === 'horizontal'
                                const screenPos = guide.position * transform.scale + (isHorizontal ? transform.offsetY : transform.offsetX)

                                return (
                                    <div
                                        key={guide.id}
                                        className="guide-line"
                                        style={{
                                            position: 'absolute',
                                            left: isHorizontal ? 0 : screenPos,
                                            top: isHorizontal ? screenPos : 0,
                                            width: isHorizontal ? '100%' : '1px',
                                            height: isHorizontal ? '1px' : '100%',
                                            backgroundColor: '#00ffff',
                                            cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
                                            zIndex: 1000,
                                            pointerEvents: 'auto'
                                        }}
                                        onMouseDown={handleExistingGuideDragStart(guide.id)}
                                    />
                                )
                            })}

                            {/* Render Temp Guide being dragged from ruler */}
                            {tempGuide && (
                                <div
                                    className="guide-line-temp"
                                    style={{
                                        position: 'absolute',
                                        left: tempGuide.orientation === 'vertical' ? (tempGuide.pos - (viewportRef.current?.getBoundingClientRect().left || 0)) : 0,
                                        top: tempGuide.orientation === 'horizontal' ? (tempGuide.pos - (viewportRef.current?.getBoundingClientRect().top || 0)) : 0,
                                        width: tempGuide.orientation === 'horizontal' ? '100%' : '1px',
                                        height: tempGuide.orientation === 'horizontal' ? '1px' : '100%',
                                        backgroundColor: '#00ffff',
                                        opacity: 0.5,
                                        zIndex: 1001,
                                        pointerEvents: 'none'
                                    }}
                                />
                            )}
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
