import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import EmptyState from './EmptyState'

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

export default function Canvas() {
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

    // Load image helper
    const loadImage = useCallback(
        (src: string, name: string) => {
            setImageSrc(src)
            setFileName(name)
            // Wait for render, then fit
            const img = new window.Image()
            img.onload = () => fitImageToView(img)
            img.src = src
        },
        [fitImageToView]
    )

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

    // Space key handling for panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && imageSrc) {
                e.preventDefault()
                setIsSpaceHeld(true)
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
    }, [imageSrc])

    // Mouse handlers for panning
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
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
            }
        },
        [isSpaceHeld, transform]
    )

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.current.x
                const dy = e.clientY - dragStart.current.y
                setTransform((prev) => ({
                    ...prev,
                    offsetX: dragStart.current.offsetX + dx,
                    offsetY: dragStart.current.offsetY + dy,
                }))
            }
        },
        [isDragging]
    )

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        if (!isSpaceHeld) {
            setIsPanning(false)
        }
    }, [isSpaceHeld])

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
                                        : ''
                                }`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            <div
                                className="canvas-infinite"
                                style={{
                                    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
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
