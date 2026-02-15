import { X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Application, extend, useTick } from '@pixi/react'
import { Container, Sprite, Graphics, Text } from 'pixi.js'
import EmptyState from './EmptyState'
import { useEditor, type Layer, type TransformData } from './EditorContext'
import PixiLayerSprite from './PixiLayerSprite'
import SelectionOverlay from './SelectionOverlay'
import CropOverlay from './CropOverlay'
import PathOverlay from './PathOverlay'
import type { ToolOptions } from '../App'
import TransformOverlay from './TransformOverlay'
import { useGoogleFont } from '../hooks/useGoogleFont'
import ContextMenu from './ContextMenu'

// Register Pixi components for @pixi/react
extend({ Container, Sprite, Graphics, Text })

interface LayerOutlineProps {
    layer: import('./EditorContext').Layer
    transform?: TransformData
}

function LayerOutline({ layer, transform }: LayerOutlineProps) {
    const draw = useCallback((g: import('pixi.js').Graphics) => {
        g.clear()
        if (!layer.data) return

        // If transform is provided, the graphics object itself will be transformed by the parent container?
        // No, LayerOutline is a sibling of PixiLayerSprite in the fragment.
        // It is NOT inside the transformed sprite.
        // So we must apply the transform to this graphics object.

        // Draw rect relative to (0,0) of the graphics object
        // The graphics object's position/scale/etc will be set via props.

        // Draw black border based on layer dimensions (0,0 to w,h)
        g.rect(0, 0, layer.data.width, layer.data.height)
        g.stroke({ width: 2, color: 0x5294e2, alpha: 1 }) // Blue selection color

    }, [layer.data])

    // Determine transform properties
    const x = transform ? transform.x : layer.x
    const y = transform ? transform.y : layer.y
    const scale = transform ? { x: transform.scaleX, y: transform.scaleY } : { x: 1, y: 1 }
    const rotation = transform ? transform.rotation : 0
    const skew = transform ? { x: transform.skewX, y: transform.skewY } : { x: 0, y: 0 }
    const pivot = transform ? { x: transform.pivotX, y: transform.pivotY } : { x: 0, y: 0 }

    return <graphics
        draw={draw}
        x={x}
        y={y}
        scale={scale}
        rotation={rotation}
        skew={skew}
        pivot={pivot}
    />
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
    const { activeLayerId, transientTransforms } = useEditor()
    const transform = transientTransforms?.[layer.id]

    if (!layer.visible) return null

    // For groups, render a Container and recurse
    if (layer.type === 'group') {
        return (
            <pixiContainer
                x={transform ? transform.x : layer.x}
                y={transform ? transform.y : layer.y}
                scale={transform ? { x: transform.scaleX, y: transform.scaleY } : { x: 1, y: 1 }}
                rotation={transform ? transform.rotation : 0}
                skew={transform ? { x: transform.skewX, y: transform.skewY } : { x: 0, y: 0 }}
                pivot={transform ? { x: transform.pivotX, y: transform.pivotY } : { x: 0, y: 0 }}
                alpha={layer.opacity / 100}
            >
                {layer.children?.slice().reverse().map(child => (
                    <PixiLayerRecursive key={child.id} layer={child} />
                ))}
            </pixiContainer>
        )
    }

    if (layer.type === 'text') {
        useGoogleFont(layer.textStyle?.fontFamily || 'Arial');

        return (
            <React.Fragment>
                <pixiText
                    text={layer.text || ''}
                    x={transform ? transform.x : layer.x}
                    y={transform ? transform.y : layer.y}
                    scale={transform ? { x: transform.scaleX, y: transform.scaleY } : { x: 1, y: 1 }}
                    rotation={transform ? transform.rotation : 0}
                    skew={transform ? { x: transform.skewX, y: transform.skewY } : { x: 0, y: 0 }}
                    pivot={transform ? { x: transform.pivotX, y: transform.pivotY } : { x: 0, y: 0 }}
                    alpha={layer.opacity / 100}
                    style={layer.textStyle ? {
                        fontFamily: layer.textStyle.fontFamily,
                        fontSize: layer.textStyle.fontSize,
                        fill: layer.textStyle.fill,
                        align: layer.textStyle.align,
                        fontWeight: layer.textStyle.fontWeight as any,
                        fontStyle: layer.textStyle.fontStyle as any,
                        letterSpacing: layer.textStyle.letterSpacing,
                    } : { fontFamily: 'Arial', fontSize: 24, fill: '#000000' }}
                />
                {/* Font status: {fontStatus} - triggering re-render on load */}
                {layer.id === activeLayerId && (
                    // Simple outline for text? Or just bounding box?
                    // Text metrics are hard to get synchronously in React render without ref.
                    // For now, skip outline or use estimated size.
                    <LayerOutline layer={{ ...layer, data: { width: 100, height: 30 } as any }} transform={transform} />
                )}
            </React.Fragment>
        )
    }

    // For regular layers, render the sprite and optional outline
    // Note: The outline might need to follow the transform too, or we rely on the implementation of LayerOutline matching the sprite?
    // LayerOutline currently reads layer.x/y/width/height directly. 
    // It WON'T match the transform if we don't update it to use the transient transform too.
    // However, LayerOutline is a debug/assist feature. 
    // If we want it to match, we should pass the transform to it as well.

    return (
        <React.Fragment>
            <PixiLayerSprite layer={layer} transform={transform} />
            {layer.id === activeLayerId && (
                <LayerOutline layer={layer} transform={transform} />
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

                // White outer
                graphicsRef.current.circle(0, 0, brushSize / 2)
                graphicsRef.current.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.8 })

                // Black inner for contrast
                graphicsRef.current.circle(0, 0, (brushSize / 2) - 1)
                graphicsRef.current.stroke({ width: 1, color: 0x000000, alpha: 0.5 })
            }
        }
    })

    return <graphics ref={graphicsRef} draw={() => { }} />
}

// Wrapper to safely render TransformOverlay only when layerId is present
function TransformOverlayWrapper({ layerId }: { layerId: string | null }) {
    if (!layerId) return null
    return <TransformOverlay layerId={layerId} />
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
    const { layers, selection, activeLayerId } = useEditor()

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

            {/* Transform Overlay (Pixi) */}
            {activeTool === 'transform' && (
                <TransformOverlayWrapper layerId={activeLayerId} />
            )}
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
        canvasSize,
        setCanvasSize,
        addLayer,
        addTextLayer,
        updateLayerPosition,
        updateLayerData,
        updateLayerText,
        selection,
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
        backgroundColor,
        setForegroundColor,
        setBackgroundColor,
    } = useEditor()

    const [transform, setTransform] = useState<CanvasTransform>({
        offsetX: 0,
        offsetY: 0,
        scale: 1,
    })

    // Zoom Animation State
    const animationFrameId = useRef<number | null>(null)
    const activeAnimation = useRef<{
        startTime: number,
        startTransform: CanvasTransform,
        targetTransform: CanvasTransform,
        duration: number
    } | null>(null)

    const animateTo = useCallback((target: CanvasTransform, duration = 300) => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current)
        }

        activeAnimation.current = {
            startTime: performance.now(),
            startTransform: { ...transform }, // Capture current state (even if mid-animation)
            targetTransform: target,
            duration
        }

        const tick = (now: number) => {
            if (!activeAnimation.current) return

            const elapsed = now - activeAnimation.current.startTime
            const progress = Math.min(elapsed / activeAnimation.current.duration, 1)

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3)

            const start = activeAnimation.current.startTransform
            const end = activeAnimation.current.targetTransform

            const current = {
                scale: start.scale + (end.scale - start.scale) * ease,
                offsetX: start.offsetX + (end.offsetX - start.offsetX) * ease,
                offsetY: start.offsetY + (end.offsetY - start.offsetY) * ease
            }

            setTransform(current)

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(tick)
            } else {
                activeAnimation.current = null
                animationFrameId.current = null
            }
        }

        animationFrameId.current = requestAnimationFrame(tick)
    }, [transform])

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [])

    const { updateLayerTextStyle } = useEditor()

    useEffect(() => {
        if (activeTool === 'text' && activeLayerId) {
            const activeLayer = layers.find(l => l.id === activeLayerId)
            if (activeLayer?.type === 'text') {
                const style = activeLayer.textStyle;
                const hasChanged = !style ||
                    style.fontFamily !== toolOptions?.fontFamily ||
                    style.fontSize !== toolOptions?.fontSize ||
                    style.fill !== toolOptions?.textColor ||
                    style.fontWeight !== (toolOptions?.textBold ? 'bold' : 'normal') ||
                    style.fontStyle !== (toolOptions?.textItalic ? 'italic' : 'normal') ||
                    style.letterSpacing !== toolOptions?.textLetterSpacing ||
                    style.align !== toolOptions?.textAlign;

                if (hasChanged) {
                    updateLayerTextStyle(activeLayerId, {
                        fontFamily: toolOptions?.fontFamily,
                        fontSize: toolOptions?.fontSize,
                        fill: toolOptions?.textColor,
                        fontWeight: toolOptions?.textBold ? 'bold' : 'normal',
                        fontStyle: toolOptions?.textItalic ? 'italic' : 'normal',
                        letterSpacing: toolOptions?.textLetterSpacing,
                        align: toolOptions?.textAlign
                    })
                }
            }
        }
    }, [activeTool, activeLayerId, toolOptions, updateLayerTextStyle, layers])

    // Viewport state
    const [isPanning, setIsPanning] = useState(false)
    const [isSpaceHeld, setIsSpaceHeld] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0, layerX: 0, layerY: 0 })
    const cursorRef = useRef({ x: 0, y: 0 })

    // Guide dragging state
    const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null)
    const [tempGuide, setTempGuide] = useState<{ orientation: 'horizontal' | 'vertical', pos: number } | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

    // Modifier key state for Picker
    const [isCmdPressed, setIsCmdPressed] = useState(false)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Meta' || e.key === 'Control') {
                setIsCmdPressed(true)
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Meta' || e.key === 'Control') {
                setIsCmdPressed(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    // Selection state
    const isSelecting = useRef(false)
    const selectionStart = useRef({ x: 0, y: 0 })

    // Lasso state
    const currentLassoPath = useRef<{ x: number, y: number }[]>([])
    const isLassoing = useRef(false)

    const [viewportRef, setViewportRef] = useState<HTMLDivElement | null>(null)
    const pixiAppRef = useRef<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Keep the PixiJS renderer sized to the .canvas-viewport element
    useEffect(() => {
        if (!viewportRef) return

        const resize = () => {
            const app = pixiAppRef.current
            if (!app?.renderer || !app.canvas) return
            const w = viewportRef.clientWidth
            const h = viewportRef.clientHeight
            if (w > 0 && h > 0) {
                app.renderer.resize(w, h)
                const canvas = app.canvas as HTMLCanvasElement
                canvas.style.width = w + 'px'
                canvas.style.height = h + 'px'
            }
        }

        // Observe the viewport for size changes
        const ro = new ResizeObserver(resize)
        ro.observe(viewportRef)

        // Also try an initial resize after a short delay (to ensure pixi app is initialized)
        const timer = setTimeout(resize, 100)
        const timer2 = setTimeout(resize, 500)

        return () => {
            ro.disconnect()
            clearTimeout(timer)
            clearTimeout(timer2)
        }
    }, [viewportRef])

    // Drawing state
    const isDrawing = useRef(false)
    const lastDrawPoint = useRef<{ x: number; y: number } | null>(null)

    // --- Drawing helper: draw stroke segment ---
    const drawStrokeTo = useCallback((canvasX: number, canvasY: number, isFirst: boolean, history: boolean = true) => {
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
        updateLayerData(activeLayerId, newCanvas, history)
    }, [activeLayerId, layers, activeTool, toolOptions, foregroundColor, updateLayerData])

    const isPointInSelection = useCallback((x: number, y: number) => {
        if (!selection) return false
        if (selection.type === 'rect') {
            return x >= selection.x && x <= selection.x + selection.width &&
                y >= selection.y && y <= selection.y + selection.height
        }
        if (selection.type === 'ellipse') {
            const rx = selection.width / 2
            const ry = selection.height / 2
            const cx = selection.x + rx
            const cy = selection.y + ry
            if (rx === 0 || ry === 0) return false
            return (Math.pow(x - cx, 2) / Math.pow(rx, 2) + Math.pow(y - cy, 2) / Math.pow(ry, 2)) <= 1
        }
        if (selection.type === 'path' && selection.path) {
            let inside = false
            for (let i = 0, j = selection.path.length - 1; i < selection.path.length; j = i++) {
                const xi = selection.path[i].x, yi = selection.path[i].y
                const xj = selection.path[j].x, yj = selection.path[j].y
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
                if (intersect) inside = !inside
            }
            return inside
        }
        return false
    }, [selection])

    const getMergedImageData = useCallback(() => {
        if (!canvasSize) return null
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvasSize.width
        tempCanvas.height = canvasSize.height
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return null

        const drawLayerRecursive = (layer: any) => {
            if (!layer.visible) return
            if (layer.type === 'group' && layer.children) {
                [...layer.children].reverse().forEach(drawLayerRecursive)
            } else if (layer.data) {
                tempCtx.globalAlpha = (layer.opacity ?? 100) / 100
                tempCtx.globalCompositeOperation = (layer.blendMode as any) || 'source-over'
                tempCtx.drawImage(layer.data, layer.x, layer.y)
            }
        }

        [...layers].reverse().forEach(drawLayerRecursive)
        return tempCtx.getImageData(0, 0, canvasSize.width, canvasSize.height)
    }, [layers, canvasSize])

    const pickColor = useCallback((canvasX: number, canvasY: number) => {
        const mergedImageData = getMergedImageData()
        if (!mergedImageData) return

        const x = Math.round(canvasX)
        const y = Math.round(canvasY)

        if (x < 0 || y < 0 || x >= mergedImageData.width || y >= mergedImageData.height) return

        const idx = (y * mergedImageData.width + x) * 4
        const r = mergedImageData.data[idx]
        const g = mergedImageData.data[idx + 1]
        const b = mergedImageData.data[idx + 2]

        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`

        const target = isCmdPressed
            ? (toolOptions?.pickerTarget === 'fg' ? 'bg' : 'fg')
            : (toolOptions?.pickerTarget || 'fg')

        if (target === 'fg') {
            setForegroundColor(hex)
        } else {
            setBackgroundColor(hex)
        }
    }, [getMergedImageData, setForegroundColor, setBackgroundColor, toolOptions, isCmdPressed])

    // Floating Info Window Logic
    const [hoverColor, setHoverColor] = useState<{ hex: string, hsl: string } | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null)

    // Throttled color sampling for tooltip
    const lastSampleTime = useRef(0)
    const sampleColorUnderCursor = useCallback((x: number, y: number) => {
        const now = Date.now()
        if (now - lastSampleTime.current < 50) return // 20fps cap
        lastSampleTime.current = now

        const merged = getMergedImageData()
        if (!merged) return

        const lx = Math.round(x)
        const ly = Math.round(y)

        if (lx < 0 || ly < 0 || lx >= merged.width || ly >= merged.height) {
            setHoverColor(null)
            return
        }

        const idx = (ly * merged.width + lx) * 4
        const r = merged.data[idx]
        const g = merged.data[idx + 1]
        const b = merged.data[idx + 2]
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`

        // Convert to HSL
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255
        const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm)
        let h = 0, s = 0, l = (max + min) / 2
        if (max !== min) {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            if (max === rNorm) h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
            else if (max === gNorm) h = (bNorm - rNorm) / d + 2
            else h = (rNorm - gNorm) / d + 4
            h /= 6
        }
        const hDeg = Math.round(h * 360)
        const sPct = Math.round(s * 100)
        const lPct = Math.round(l * 100)

        setHoverColor({
            hex,
            hsl: `HSL ${hDeg}° ${sPct}% ${lPct}%`
        })
        setHoverPos({ x, y })
    }, [getMergedImageData])


    // --- Flood fill (bucket tool) ---
    const floodFill = useCallback((canvasX: number, canvasY: number) => {
        if (!activeLayerId) return
        const layer = layers.find((l: Layer) => l.id === activeLayerId)
        if (!layer || !layer.data || layer.locked) return

        const lx = Math.round(canvasX - layer.x)
        const ly = Math.round(canvasY - layer.y)

        const w = layer.data.width
        const h = layer.data.height

        const ctx = layer.data.getContext('2d')
        if (!ctx) return

        const imageData = ctx.getImageData(0, 0, w, h)
        const data = imageData.data
        const threshold = toolOptions?.fillThreshold ?? 15

        // Parse fill color
        const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16)
            const g = parseInt(hex.slice(3, 5), 16)
            const b = parseInt(hex.slice(5, 7), 16)
            const a = Math.round((toolOptions?.bucketOpacity ?? 100) * 2.55)
            return [r, g, b, a]
        }
        const colorToUse = toolOptions?.bucketFillType === 'bg' ? backgroundColor : foregroundColor
        const fillColor = hexToRgb(colorToUse)

        // Handle "Fill Whole Selection"
        if (toolOptions?.bucketAffectedArea === 'selection' && selection) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const canvasX_abs = x + layer.x
                    const canvasY_abs = y + layer.y
                    if (isPointInSelection(canvasX_abs, canvasY_abs)) {
                        const pi = (y * w + x) * 4
                        data[pi] = fillColor[0]
                        data[pi + 1] = fillColor[1]
                        data[pi + 2] = fillColor[2]
                        data[pi + 3] = fillColor[3]
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0)

            // Clone canvas to trigger update
            const newCanvas = document.createElement('canvas')
            newCanvas.width = w
            newCanvas.height = h
            const newCtx = newCanvas.getContext('2d')
            newCtx?.drawImage(layer.data, 0, 0)
            updateLayerData(activeLayerId, newCanvas)
            return
        }

        // Standard Flood Fill or Sample Merged
        if (lx < 0 || ly < 0 || lx >= w || ly >= h) return

        let sampleData = data
        let sampleW = w
        if (toolOptions?.bucketSampleMerged) {
            const merged = getMergedImageData()
            if (merged) {
                sampleData = merged.data as any
                sampleW = merged.width
            }
        }

        // Get target color index
        const getIdx = (x: number, y: number, sw: number, srw: number, l: any) => {
            if (toolOptions?.bucketSampleMerged) {
                // Merged sampling uses absolute canvas coords
                const absX = Math.round(x + l.x)
                const absY = Math.round(y + l.y)
                if (absX < 0 || absY < 0 || absX >= srw || absY >= (sampleData.length / (srw * 4))) return -1
                return (absY * srw + absX) * 4
            }
            return (y * sw + x) * 4
        }

        const startIdx = getIdx(lx, ly, w, sampleW, layer)
        if (startIdx === -1) return
        const targetColor = [sampleData[startIdx], sampleData[startIdx + 1], sampleData[startIdx + 2], sampleData[startIdx + 3]]

        // Check if colors match (within threshold)
        const colorMatch = (x: number, y: number) => {
            const i = getIdx(x, y, w, sampleW, layer)
            if (i === -1) return false
            return (
                Math.abs(sampleData[i] - targetColor[0]) <= threshold &&
                Math.abs(sampleData[i + 1] - targetColor[1]) <= threshold &&
                Math.abs(sampleData[i + 2] - targetColor[2]) <= threshold &&
                Math.abs(sampleData[i + 3] - targetColor[3]) <= threshold
            )
        }

        // Don't fill if target is already fill color (approximate)
        if (
            targetColor[0] === fillColor[0] &&
            targetColor[1] === fillColor[1] &&
            targetColor[2] === fillColor[2] &&
            Math.abs(targetColor[3] - fillColor[3]) < 2 &&
            !toolOptions?.bucketSampleMerged
        ) return

        // Scanline flood fill
        const stack: [number, number][] = [[lx, ly]]
        const visited = new Uint8Array(w * h)

        while (stack.length > 0) {
            const [sx, sy] = stack.pop()!
            let x = sx

            while (x > 0 && colorMatch(x - 1, sy) && !visited[sy * w + x - 1]) {
                x--
            }

            let spanAbove = false
            let spanBelow = false

            while (x < w && colorMatch(x, sy) && !visited[sy * w + x]) {
                const pi = (sy * w + x) * 4
                data[pi] = fillColor[0]
                data[pi + 1] = fillColor[1]
                data[pi + 2] = fillColor[2]
                data[pi + 3] = fillColor[3]
                visited[sy * w + x] = 1

                if (sy > 0) {
                    if (colorMatch(x, sy - 1) && !visited[(sy - 1) * w + x]) {
                        if (!spanAbove) {
                            stack.push([x, sy - 1])
                            spanAbove = true
                        }
                    } else {
                        spanAbove = false
                    }
                }

                if (sy < h - 1) {
                    if (colorMatch(x, sy + 1) && !visited[(sy + 1) * w + x]) {
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
        newCanvas.width = w
        newCanvas.height = h
        const newCtx = newCanvas.getContext('2d')
        newCtx?.drawImage(layer.data, 0, 0)
        updateLayerData(activeLayerId, newCanvas)
    }, [activeLayerId, layers, foregroundColor, backgroundColor, toolOptions, updateLayerData, isPointInSelection, getMergedImageData, selection])

    // Fit image/canvas to viewport
    const fitToView = useCallback((w: number, h: number) => {
        const viewport = viewportRef
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

    // --- Magic Wand Select ---
    const magicWandSelect = useCallback((canvasX: number, canvasY: number) => {
        if (!activeLayerId) return
        const layer = layers.find((l: Layer) => l.id === activeLayerId)
        if (!layer || !layer.data) return

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

        const idx = (ly * w + lx) * 4
        const targetColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]

        const colorMatch = (i: number) => (
            Math.abs(data[i] - targetColor[0]) <= threshold &&
            Math.abs(data[i + 1] - targetColor[1]) <= threshold &&
            Math.abs(data[i + 2] - targetColor[2]) <= threshold &&
            Math.abs(data[i + 3] - targetColor[3]) <= threshold
        )

        // Flood fill to build a binary mask
        const mask = new Uint8Array(w * h)
        const stack: [number, number][] = [[lx, ly]]
        mask[ly * w + lx] = 1
        let minX = w, maxX = 0, minY = h, maxY = 0

        while (stack.length > 0) {
            const [cx, cy] = stack.pop()!
            if (cx < minX) minX = cx
            if (cx > maxX) maxX = cx
            if (cy < minY) minY = cy
            if (cy > maxY) maxY = cy
            const nbrs: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]
            for (const [nx, ny] of nbrs) {
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const nIdx = ny * w + nx
                    if (mask[nIdx] === 0 && colorMatch(nIdx * 4)) {
                        mask[nIdx] = 1
                        stack.push([nx, ny])
                    }
                }
            }
        }

        // Find top-leftmost selected pixel
        let startX = -1, startY = -1
        findStart: for (let sy = minY; sy <= maxY; sy++) {
            for (let sx = minX; sx <= maxX; sx++) {
                if (mask[sy * w + sx] === 1) {
                    startX = sx
                    startY = sy
                    break findStart
                }
            }
        }
        if (startX === -1) return

        // Boundary tracing (left-hand rule, 4-connectivity)
        // Directions: 0=N, 1=E, 2=S, 3=W
        const dxArr = [0, 1, 0, -1]
        const dyArr = [-1, 0, 1, 0]
        let tx = startX, ty = startY, facing = 1
        const rawPath: { x: number; y: number }[] = []
        let loops = 0
        const maxLoops = w * h * 2

        const checkDir = (d: number) => {
            const nx = tx + dxArr[d], ny = ty + dyArr[d]
            return nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx] === 1
        }

        do {
            rawPath.push({ x: tx + layer.x, y: ty + layer.y })
            const left = (facing + 3) % 4
            const right = (facing + 1) % 4
            const back = (facing + 2) % 4
            if (checkDir(left)) facing = left
            else if (!checkDir(facing)) {
                if (checkDir(right)) facing = right
                else facing = back
            }
            tx += dxArr[facing]
            ty += dyArr[facing]
            loops++
        } while ((tx !== startX || ty !== startY) && loops < maxLoops)

        // Simplify: skip collinear points
        const simplified: { x: number; y: number }[] = []
        if (rawPath.length > 2) {
            simplified.push(rawPath[0])
            for (let i = 1; i < rawPath.length - 1; i++) {
                const prev = rawPath[i - 1], curr = rawPath[i], next = rawPath[i + 1]
                if (curr.x - prev.x !== next.x - curr.x || curr.y - prev.y !== next.y - curr.y) {
                    simplified.push(curr)
                }
            }
            simplified.push(rawPath[rawPath.length - 1])
        } else {
            simplified.push(...rawPath)
        }

        setSelection({
            type: 'path',
            x: minX + layer.x,
            y: minY + layer.y,
            width: maxX - minX,
            height: maxY - minY,
            path: simplified
        })
    }, [activeLayerId, layers, toolOptions, setSelection])

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

    const handleDoubleClick = useCallback(() => {
        if (!activeLayerId) return
        const layer = layers.find(l => l.id === activeLayerId)
        if (layer && layer.type === 'text') {
            const newText = prompt('Edit text:', layer.text)
            if (newText !== null && newText !== layer.text) {
                updateLayerText(activeLayerId, newText)
            }
        }
    }, [activeLayerId, layers, updateLayerText])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.detail === 2) {
            handleDoubleClick()
            return
        }
        if (!viewportRef) return

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

        const rect = viewportRef.getBoundingClientRect()
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
        } else if (activeTool === 'lasso-select') {
            isLassoing.current = true
            currentLassoPath.current = [{ x: canvasX, y: canvasY }]
            setSelection({
                type: 'path',
                x: canvasX,
                y: canvasY,
                width: 0,
                height: 0,
                path: [{ x: canvasX, y: canvasY }]
            })
        } else if (activeTool === 'wand-select') {
            magicWandSelect(canvasX, canvasY)
        } else if (activeTool === 'brush' || activeTool === 'pencil' || activeTool === 'eraser') {
            setIsDragging(true)
            isDrawing.current = true
            lastDrawPoint.current = null
            drawStrokeTo(canvasX, canvasY, true, false)
        } else if (activeTool === 'bucket') {
            floodFill(canvasX, canvasY)
        } else if (activeTool === 'picker') {
            pickColor(canvasX, canvasY)
        } else if (activeTool === 'text') {
            const defaultText = prompt('Enter text:', 'New Text Layer')
            if (defaultText) {
                const style = {
                    fontFamily: toolOptions?.fontFamily || 'Arial',
                    fontSize: toolOptions?.fontSize || 24,
                    fill: toolOptions?.textColor || '#000000',
                    align: toolOptions?.textAlign || 'left',
                    fontWeight: toolOptions?.textBold ? 'bold' : 'normal',
                    fontStyle: toolOptions?.textItalic ? 'italic' : 'normal',
                    letterSpacing: toolOptions?.textLetterSpacing || 0
                }
                addTextLayer(defaultText, style, canvasX, canvasY)
            }
        } else if (activeTool === 'zoom') {
            const effectiveDirection = isCmdPressed
                ? (toolOptions?.zoomDirection === 'in' ? 'out' : 'in')
                : (toolOptions?.zoomDirection || 'in')

            const zoomFactor = effectiveDirection === 'in' ? 2 : 0.5
            const targetScale = Math.min(Math.max(transform.scale * zoomFactor, 0.05), 20)

            // Calculate target offset to keep mouse position stable
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            const targetOffsetX = mouseX - (mouseX - transform.offsetX) * (targetScale / transform.scale)
            const targetOffsetY = mouseY - (mouseY - transform.offsetY) * (targetScale / transform.scale)

            animateTo({ scale: targetScale, offsetX: targetOffsetX, offsetY: targetOffsetY })
        }
    }, [isSpaceHeld, transform, activeTool, activeLayerId, layers, setSelection, drawStrokeTo, floodFill, pickColor, magicWandSelect, toolOptions, addTextLayer, isCmdPressed, viewportRef])

    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!viewportRef) return

        // Cursor tracking
        const rect = viewportRef.getBoundingClientRect()
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
            const rect = viewportRef.getBoundingClientRect()

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
                dragStart.current.layerY + dy,
                false
            )
        } else if (activeTool === 'lasso-select' && isLassoing.current) {
            currentLassoPath.current.push({ x: canvasX, y: canvasY })

            const xs = currentLassoPath.current.map(p => p.x)
            const ys = currentLassoPath.current.map(p => p.y)
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)

            setSelection({
                type: 'path',
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                path: [...currentLassoPath.current]
            })
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
            drawStrokeTo(canvasX, canvasY, false, false)
        }

    }, [isPanning, isDragging, activeTool, activeLayerId, transform, onCursorMove, updateLayerPosition, setSelection, tempGuide, draggingGuideId, guides, updateGuide, drawStrokeTo])

    const handleMouseUp = useCallback((e: React.MouseEvent | MouseEvent) => {
        setIsDragging(false)
        setIsPanning(false)
        isSelecting.current = false
        isLassoing.current = false

        // Finish drawing stroke
        if (isDrawing.current && activeLayerId) {
            const layer = layers.find(l => l.id === activeLayerId)
            if (layer && layer.data) {
                // Commit final state to history
                updateLayerData(activeLayerId, layer.data, true)
            }
            isDrawing.current = false
            lastDrawPoint.current = null
        }

        // Commit move to history
        if (activeTool === 'move' && isDragging && activeLayerId) {
            const layer = layers.find(l => l.id === activeLayerId)
            if (layer) {
                updateLayerPosition(activeLayerId, layer.x, layer.y, true)
            }
        }

        // Finish guide dragging
        if (tempGuide && viewportRef) {
            const rect = viewportRef.getBoundingClientRect()
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

        if (draggingGuideId && viewportRef) {
            const rect = viewportRef.getBoundingClientRect()
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

    }, [tempGuide, draggingGuideId, transform, addGuide, removeGuide, activeLayerId, layers, activeTool, isDragging, updateLayerData, updateLayerPosition])

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

        const viewport = viewportRef
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
                            ref={setViewportRef}
                            className={`canvas-viewport ${isPanning ? 'panning-active' : isSpaceHeld ? 'panning-ready' : ''} ${activeTool === 'move' ? 'cursor-move' : ''} ${activeTool.includes('select') ? 'crosshair' : ''} ${activeTool === 'picker' ? 'cursor-picker' : ''}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={(e) => {
                                handleMouseMove(e)
                                if (activeTool === 'picker') {
                                    const rect = viewportRef?.getBoundingClientRect()
                                    if (rect) {
                                        const x = (e.clientX - rect.left - transform.offsetX) / transform.scale
                                        const y = (e.clientY - rect.top - transform.offsetY) / transform.scale
                                        sampleColorUnderCursor(x, y)
                                        // Also update hover pos relative to viewport for the tooltip positioning
                                        setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top + 20 }) // Offset slightly
                                    }
                                } else {
                                    setHoverColor(null)
                                }
                            }}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={(e) => {
                                handleMouseUp(e)
                                setHoverColor(null)
                            }}
                            onWheel={handleWheel}
                            onContextMenu={(e) => {
                                e.preventDefault()
                                setContextMenu({ x: e.clientX, y: e.clientY })
                            }}
                        >
                            <div
                                className="viewport"
                                style={{
                                    /* 
                                     * Infinite Canvas Logic:
                                     * The viewport/canvas fills the screen.
                                     * We DO NOT transform this container.
                                     * Instead, we transform the content inside (PixiScene) 
                                     * and the HTML overlays.
                                     */
                                    width: '100%',
                                    height: '100%',
                                    cursor: isPanning ? 'grab' :
                                        isSpaceHeld ? 'grab' :
                                            activeTool === 'move' ? 'default' :
                                                activeTool === 'text' ? 'text' :
                                                    activeTool === 'zoom' ? (
                                                        (isCmdPressed
                                                            ? (toolOptions?.zoomDirection === 'in' ? 'zoom-out' : 'zoom-in')
                                                            : (toolOptions?.zoomDirection === 'out' ? 'zoom-out' : 'zoom-in'))
                                                    ) :
                                                        'crosshair',
                                }}
                            >
                                <Application
                                    backgroundColor={0x505050}
                                    backgroundAlpha={0} // Transparent background so checkboard shows through
                                    onInit={(app: any) => { pixiAppRef.current = app }}
                                >
                                    <PixiScene
                                        transform={transform}
                                        cursorRef={cursorRef}
                                        toolOptions={toolOptions}
                                        activeTool={activeTool}
                                    />
                                </Application>

                                {/* Floating Info Window for Color Picker */}
                                {activeTool === 'picker' && hoverColor && hoverPos && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: hoverPos.x + 15,
                                            top: hoverPos.y + 15,
                                            width: 170, // Fixed width to prevent wiggling
                                            background: 'rgba(30, 30, 30, 0.95)',
                                            backdropFilter: 'blur(4px)',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            color: 'white',
                                            fontSize: 12,
                                            pointerEvents: 'none',
                                            zIndex: 1000,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <div style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 6,
                                            background: hoverColor.hex,
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.2)'
                                        }} />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{hoverColor.hex.toUpperCase()}</span>
                                            <span style={{ fontSize: 11, opacity: 0.8, fontFamily: 'monospace' }}>{hoverColor.hsl}</span>
                                            <span style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{isCmdPressed ? 'Click to Set BG' : 'Click to Set FG'}</span>
                                        </div>
                                    </div>
                                )}

                                {/* React overlays (HTML) - now transformed to match Pixi */}
                                <div
                                    className="overlays"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%', // Fill the infinite canvas space? No, transformed.
                                        // Wait, if we transform this container, its origin (0,0) moves.
                                        // The content inside expects (0,0) to be the image (0,0).
                                        // So we should just apply the transform here.
                                        transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
                                        transformOrigin: '0 0',
                                        pointerEvents: 'none', // Pass events to Pixi unless interacting with handles
                                    }}
                                >
                                    {activeTool === 'crop' && (
                                        <div style={{ pointerEvents: 'auto' }}>
                                            <CropOverlay
                                                onCrop={(rect) => {
                                                    cropCanvas(rect.x, rect.y, rect.width, rect.height, toolOptions?.cropDeletePixels)
                                                    onToolChange?.('move')
                                                }}
                                                onCancel={() => onToolChange?.('move')}
                                                scale={1}
                                                zoomLevel={transform.scale}
                                                offsetX={0}
                                                offsetY={0}
                                                toolOptions={toolOptions}
                                            />
                                        </div>
                                    )}

                                    {activeTool === 'paths' && (
                                        <div style={{ pointerEvents: 'auto' }}>
                                            <PathOverlay
                                                scale={transform.scale}
                                                offsetX={transform.offsetX}
                                                offsetY={transform.offsetY}
                                                toolOptions={toolOptions}
                                            />
                                        </div>
                                    )}


                                </div>

                                {/* Scrollbars would go here if we implemented custom ones */}

                                {/* Context Menu */}
                                {contextMenu && (
                                    <ContextMenu
                                        x={contextMenu.x}
                                        y={contextMenu.y}
                                        onClose={() => setContextMenu(null)}
                                        onSelect={(toolId) => onToolChange?.(toolId)}
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
                                            left: tempGuide.orientation === 'vertical' ? (tempGuide.pos - (viewportRef?.getBoundingClientRect()?.left || 0)) : 0,
                                            top: tempGuide.orientation === 'horizontal' ? (tempGuide.pos - (viewportRef?.getBoundingClientRect()?.top || 0)) : 0,
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
