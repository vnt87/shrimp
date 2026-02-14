import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import EmptyState from './EmptyState'

interface CanvasTransform {
    offsetX: number
    offsetY: number
    scale: number
}

interface CropRect {
    x: number
    y: number
    width: number
    height: number
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

export default function Canvas({
    onCursorMove,
    activeTool = 'move',
}: {
    onCursorMove?: (pos: { x: number; y: number } | null) => void
    activeTool?: string
}) {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [fileName, setFileName] = useState<string>('')
    const [transform, setTransform] = useState<CanvasTransform>({
        offsetX: 0,
        offsetY: 0,
        scale: 1,
    })
    const [isPanning, setIsPanning] = useState(false)
    const [isSpaceHeld, setIsSpaceHeld] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })
    const viewportRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Crop State
    const [cropRect, setCropRect] = useState<CropRect | null>(null)
    const [isCropping, setIsCropping] = useState(false)
    const cropStart = useRef<{ x: number; y: number } | null>(null)

    // Resizing State
    const [resizingCheck, setResizingCheck] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
    const resizeStart = useRef<{ x: number; y: number; rect: CropRect } | null>(null)

    // History State
    const [history, setHistory] = useState<string[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)

    // Fit image to viewport on load
    const fitImageToView = useCallback(
        (img: HTMLImageElement) => {
            const viewport = viewportRef.current
            if (!viewport) return

            const vw = viewport.clientWidth
            const vh = viewport.clientHeight
            const iw = img.naturalWidth
            const ih = img.naturalHeight

            const scaleX = vw / iw
            const scaleY = vh / ih
            const scale = Math.min(scaleX, scaleY, 1) * 0.85

            const offsetX = (vw - iw * scale) / 2
            const offsetY = (vh - ih * scale) / 2

            setTransform({ offsetX, offsetY, scale })
        },
        []
    )

    // Helper to update image and history
    const updateImage = useCallback((src: string, newFile: boolean = false) => {
        setImageSrc(src)

        // Load image to fit view
        const img = new window.Image()
        img.onload = () => {
            // We might want to only fit to view on new files, or if dimensions change drastically?
            // For now, consistent behavior: always fit. 
            // Improvements: Check if aspect ratio/size allows keeping current transform?
            // Let's stick to fitting for simplicity and consistent "reset" feeling on undo/redo actions that change dimensions.
            fitImageToView(img)
        }
        img.src = src

        if (newFile) {
            setHistory([src])
            setHistoryIndex(0)
            setFileName((prev) => prev) // Name handles locally
        } else {
            setHistory((prev) => {
                const newHistory = prev.slice(0, historyIndex + 1)
                newHistory.push(src)
                return newHistory
            })
            setHistoryIndex((prev) => prev + 1)
        }
    }, [historyIndex, fitImageToView])

    // Load image helper (entry point for new files)
    const loadImage = useCallback(
        (src: string, name: string) => {
            setFileName(name)
            setCropRect(null)
            updateImage(src, true)
        },
        [updateImage]
    )

    // Undo/Redo functions
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1
            setHistoryIndex(newIndex)
            const src = history[newIndex]
            setImageSrc(src)
            setCropRect(null)

            // Re-fit?
            const img = new window.Image()
            img.onload = () => fitImageToView(img)
            img.src = src
        }
    }, [historyIndex, history, fitImageToView])

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1
            setHistoryIndex(newIndex)
            const src = history[newIndex]
            setImageSrc(src)
            setCropRect(null)

            const img = new window.Image()
            img.onload = () => fitImageToView(img)
            img.src = src
        }
    }, [historyIndex, history, fitImageToView])

    // Handle loading the sample image
    const handleLoadSample = useCallback(() => {
        loadImage('/cathedral.jpg', 'cathedral.jpg')
    }, [loadImage])

    // Handle opening a local file
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

    // Handle paste from clipboard
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
            alert(
                'Could not read clipboard. Make sure you have an image copied and have granted clipboard permissions.'
            )
        }
    }, [loadImage])

    // Apply Crop
    const applyCrop = useCallback(() => {
        if (!imageRef.current || !cropRect) return

        const img = imageRef.current
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Ensure crop rect is within bounds and positive
        const x = Math.max(0, cropRect.x)
        const y = Math.max(0, cropRect.y)
        const width = Math.min(img.naturalWidth - x, cropRect.width)
        const height = Math.min(img.naturalHeight - y, cropRect.height)

        if (width <= 0 || height <= 0) return

        canvas.width = width
        canvas.height = height

        ctx.drawImage(img, x, y, width, height, 0, 0, width, height)

        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob)
                setCropRect(null)
                // Add to history
                updateImage(url, false)
            }
        })
    }, [cropRect, updateImage])

    // Space key handling for panning and Enter for crop
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return

            // Undo/Redo shortcuts (Ctrl+Z, Cmd+Z, Ctrl+Shift+Z, Cmd+Shift+Z, Cmd+Y)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    redo()
                } else {
                    undo()
                }
                return
            }
            // Redo often has Ctrl+Y as alternative
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault()
                redo()
                return
            }

            if (e.code === 'Space' && imageSrc) {
                // Only allow panning if we're not actively dragging a crop handle (though space overrides everything usually)
                e.preventDefault()
                setIsSpaceHeld(true)
            } else if (e.key === 'Enter' && activeTool === 'crop' && cropRect) {
                e.preventDefault()
                applyCrop()
            } else if (e.key === 'Escape' && activeTool === 'crop') {
                e.preventDefault()
                setCropRect(null)
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
    }, [imageSrc, activeTool, cropRect, applyCrop, undo, redo])

    // Mouse handlers
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Panning takes precedence if Space is held
            if (isSpaceHeld) {
                e.preventDefault()
                setIsPanning(true)
                setIsDragging(true)
                dragStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    offsetX: transform.offsetX,
                    offsetY: transform.offsetY,
                }
                return
            }

            // Check if clicking a handle
            if (activeTool === 'crop' && cropRect) {
                const target = e.target as HTMLElement
                if (target.classList.contains('crop-handle')) {
                    const handle = target.classList.contains('nw') ? 'nw' :
                        target.classList.contains('ne') ? 'ne' :
                            target.classList.contains('sw') ? 'sw' : 'se'
                    setResizingCheck(handle)
                    resizeStart.current = {
                        x: e.clientX,
                        y: e.clientY,
                        rect: { ...cropRect }
                    }
                    e.stopPropagation()
                    return
                }
            }

            // Crop Tool Logic (New Crop)
            if (activeTool === 'crop' && imageSrc && viewportRef.current) {
                // Only start new crop if we aren't clicking inside an existing one?
                // For now, let's assume clicking outside resets, or dragging starts new.
                // Simple: always start new if not hitting handle (and maybe later check if inside rect to move it)

                const rect = viewportRef.current.getBoundingClientRect()
                const x = (e.clientX - rect.left - transform.offsetX) / transform.scale
                const y = (e.clientY - rect.top - transform.offsetY) / transform.scale

                setIsCropping(true)
                cropStart.current = { x, y }
                setCropRect({ x, y, width: 0, height: 0 })
                return
            }
        },
        [isSpaceHeld, activeTool, imageSrc, transform, cropRect]
    )

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isSpaceHeld && isDragging) {
                const dx = e.clientX - dragStart.current.x
                const dy = e.clientY - dragStart.current.y
                setTransform((prev) => ({
                    ...prev,
                    offsetX: dragStart.current.offsetX + dx,
                    offsetY: dragStart.current.offsetY + dy,
                }))
            } else if (activeTool === 'crop' && resizingCheck && resizeStart.current && viewportRef.current) {
                // Resizing Logic
                const rect = viewportRef.current.getBoundingClientRect()
                const currentX = (e.clientX - rect.left - transform.offsetX) / transform.scale
                const currentY = (e.clientY - rect.top - transform.offsetY) / transform.scale

                const startRect = resizeStart.current.rect
                let newX = startRect.x
                let newY = startRect.y
                let newW = startRect.width
                let newH = startRect.height

                // Helper to keep aspect ratio or just free resize? Free for now.
                if (resizingCheck === 'se') {
                    newW = currentX - startRect.x
                    newH = currentY - startRect.y
                } else if (resizingCheck === 'sw') {
                    newX = currentX
                    newW = (startRect.x + startRect.width) - currentX
                    newH = currentY - startRect.y
                } else if (resizingCheck === 'ne') {
                    newY = currentY
                    newW = currentX - startRect.x
                    newH = (startRect.y + startRect.height) - currentY
                } else if (resizingCheck === 'nw') {
                    newX = currentX
                    newY = currentY
                    newW = (startRect.x + startRect.width) - currentX
                    newH = (startRect.y + startRect.height) - currentY
                }

                // Normalize negatives
                if (newW < 0) {
                    newX += newW
                    newW = Math.abs(newW)
                    // Flip handle logic if we cross over? For simplicity, just behave weirdly or fix handle?
                    // A robust implementation swaps handles. For this iteration, let's just allow it.
                }
                if (newH < 0) {
                    newY += newH
                    newH = Math.abs(newH)
                }

                setCropRect({ x: newX, y: newY, width: newW, height: newH })
            } else if (activeTool === 'crop' && isCropping && cropStart.current && viewportRef.current) {
                // Creating Logic
                const rect = viewportRef.current.getBoundingClientRect()
                const currentX = (e.clientX - rect.left - transform.offsetX) / transform.scale
                const currentY = (e.clientY - rect.top - transform.offsetY) / transform.scale

                const startX = cropStart.current.x
                const startY = cropStart.current.y

                const width = Math.abs(currentX - startX)
                const height = Math.abs(currentY - startY)
                const x = Math.min(startX, currentX)
                const y = Math.min(startY, currentY)

                setCropRect({ x, y, width, height })
            }

            // Cursor position tracking
            if (imageSrc && viewportRef.current && onCursorMove) {
                const rect = viewportRef.current.getBoundingClientRect()
                const x = Math.round(
                    (e.clientX - rect.left - transform.offsetX) / transform.scale
                )
                const y = Math.round(
                    (e.clientY - rect.top - transform.offsetY) / transform.scale
                )
                onCursorMove({ x, y })
            }
        },
        [isSpaceHeld, isDragging, activeTool, isCropping, resizingCheck, imageSrc, transform, onCursorMove]
    )

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        if (!isSpaceHeld) {
            setIsPanning(false)
        }
        setIsCropping(false)
        cropStart.current = null
        setResizingCheck(null)
        resizeStart.current = null
    }, [isSpaceHeld])

    const handleMouseLeave = useCallback(() => {
        handleMouseUp()
        if (onCursorMove) {
            onCursorMove(null)
        }
    }, [handleMouseUp, onCursorMove])

    // Wheel zoom
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            if (!imageSrc) return
            e.preventDefault()

            const viewport = viewportRef.current
            if (!viewport) return

            const rect = viewport.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9

            setTransform((prev) => {
                const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.05), 20)
                // Zoom toward cursor
                const newOffsetX =
                    mouseX - (mouseX - prev.offsetX) * (newScale / prev.scale)
                const newOffsetY =
                    mouseY - (mouseY - prev.offsetY) * (newScale / prev.scale)
                return { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale }
            })
        },
        [imageSrc]
    )

    // Re-fit when viewport resizes and image is loaded
    useEffect(() => {
        if (!imageSrc || !imageRef.current) return
        const img = imageRef.current
        if (img.naturalWidth > 0) {
            fitImageToView(img)
        }
    }, []) // only on mount

    return (
        <div className="canvas-area">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {imageSrc ? (
                <>
                    {/* File Tabs */}
                    <div className="canvas-tabs">
                        <div className="canvas-tab active">
                            <span>{fileName}</span>
                            <div
                                className="tab-close"
                                onClick={() => {
                                    setImageSrc(null)
                                    setFileName('')
                                    setTransform({ offsetX: 0, offsetY: 0, scale: 1 })
                                    setCropRect(null)
                                    if (onCursorMove) onCursorMove(null)
                                }}
                            >
                                <X size={10} />
                            </div>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="canvas-separator" />

                    {/* Rulers + Canvas viewport */}
                    <div className="canvas-with-rulers">
                        {/* Corner */}
                        <div className="ruler-corner" />

                        {/* Horizontal ruler */}
                        <div className="ruler-horizontal">
                            <Ruler orientation="horizontal" transform={transform} />
                        </div>

                        {/* Vertical ruler */}
                        <div className="ruler-vertical">
                            <Ruler orientation="vertical" transform={transform} />
                        </div>

                        {/* Canvas viewport — infinite canvas */}
                        <div
                            ref={viewportRef}
                            className={`canvas-viewport ${isPanning
                                ? 'panning-active'
                                : isSpaceHeld
                                    ? 'panning-ready'
                                    : activeTool === 'crop'
                                        ? 'crosshair'
                                        : ''
                                }`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            onWheel={handleWheel}
                        >
                            <div
                                className="canvas-infinite"
                                style={{
                                    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
                                    transformOrigin: '0 0',
                                }}
                            >
                                <img
                                    ref={imageRef}
                                    src={imageSrc}
                                    alt="Canvas content"
                                    className="canvas-image-infinite"
                                    draggable={false}
                                    onLoad={(e) =>
                                        fitImageToView(e.target as HTMLImageElement)
                                    }
                                />
                                {activeTool === 'crop' && cropRect && (
                                    <div
                                        className="crop-overlay"
                                        style={{
                                            left: `${cropRect.x}px`,
                                            top: `${cropRect.y}px`,
                                            width: `${cropRect.width}px`,
                                            height: `${cropRect.height}px`,
                                        }}
                                    >
                                        <div className="crop-handle nw" />
                                        <div className="crop-handle ne" />
                                        <div className="crop-handle sw" />
                                        <div className="crop-handle se" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Empty State */
                <EmptyState
                    onLoadSample={handleLoadSample}
                    onOpenFile={handleOpenFile}
                    onPasteClipboard={handlePasteClipboard}
                />
            )}
        </div>
    )
}
