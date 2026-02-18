import { useState, useEffect, useCallback, useRef } from 'react'
import { Wand2, X, AlertCircle } from 'lucide-react'
import { useEditor } from './EditorContext'
import { selectionToMask } from '../utils/contentAwareFill'

/**
 * Content-Aware Fill Modal
 *
 * Floating panel anchored below (or above) the active selection, mirroring
 * the layout pattern of GenFillModal.tsx.
 *
 * Workflow:
 *  1. User makes a selection and triggers Edit → Content-Aware Fill
 *  2. This modal appears, showing a preview of the selection region
 *  3. User clicks "Fill" → worker runs PatchMatch inpainting
 *  4. Result is added as a new layer; selection stays active
 *
 * Processing happens entirely on-device (CImg WASM) — no external API calls.
 */
export default function ContentAwareFillModal() {
    const {
        selection,
        canvasSize,
        viewTransform,
        layers,
        activeLayerId,
        addLayer,
        setCAFModalOpen,
    } = useEditor()

    // --- local state ---
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)          // 0–1
    const [error, setError] = useState<string | null>(null)
    const [position, setPosition] = useState({ x: 0, y: 0, caretOffset: 160 })

    /** Reference to the Web Worker — created once and reused */
    const workerRef = useRef<Worker | null>(null)
    /** Abort flag — set when user cancels mid-fill */
    const cancelledRef = useRef(false)

    const MODAL_WIDTH = 300
    /** Canvas element used to render a live preview of the selected region */
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

    // -------------------------------------------------------------------------
    // Worker lifecycle
    // -------------------------------------------------------------------------

    useEffect(() => {
        // Spawn the CAF Web Worker once on mount
        workerRef.current = new Worker(
            new URL('../workers/contentAwareFill.worker.ts', import.meta.url),
            { type: 'module' }
        )

        // Warm up: pre-load the WASM module while the user looks at the modal
        workerRef.current.postMessage({ type: 'preload' })

        return () => {
            // Terminate worker when modal unmounts
            workerRef.current?.terminate()
            workerRef.current = null
        }
    }, [])

    // -------------------------------------------------------------------------
    // Modal position (same logic as GenFillModal)
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (!selection) return

        const vpEl = document.querySelector('.canvas-viewport') as HTMLElement | null
        const vpRect = vpEl?.getBoundingClientRect() ?? { left: 0, top: 0 }

        const selCentreX =
            vpRect.left +
            viewTransform.offsetX +
            (selection.x + selection.width / 2) * viewTransform.scale

        const selBottomY =
            vpRect.top +
            viewTransform.offsetY +
            (selection.y + selection.height) * viewTransform.scale +
            12

        const MODAL_APPROX_H = 160
        const GAP = 8
        const winW = window.innerWidth
        const winH = window.innerHeight

        let left = selCentreX - MODAL_WIDTH / 2
        left = Math.max(GAP, Math.min(winW - MODAL_WIDTH - GAP, left))

        const caretOffset = Math.max(16, Math.min(MODAL_WIDTH - 32, selCentreX - left))

        let top = selBottomY
        if (top + MODAL_APPROX_H > winH - GAP) {
            const selTopY =
                vpRect.top +
                viewTransform.offsetY +
                selection.y * viewTransform.scale -
                MODAL_APPROX_H -
                12
            top = Math.max(GAP, selTopY)
        }

        setPosition({ x: left, y: top, caretOffset })
    }, [selection, viewTransform])

    // -------------------------------------------------------------------------
    // Fill action
    // -------------------------------------------------------------------------

    const handleFill = useCallback(() => {
        if (!selection || !workerRef.current) return

        const activeLayer = layers.find(l => l.id === activeLayerId)
        if (!activeLayer?.data) {
            setError('No active layer with image data.')
            return
        }

        cancelledRef.current = false
        setIsProcessing(true)
        setError(null)
        setProgress(0)

        // Generate binary mask from current selection
        const mask = selectionToMask(selection, canvasSize.width, canvasSize.height)

        // Extract full-canvas image data from the active layer
        const layerCtx = activeLayer.data.getContext('2d')
        if (!layerCtx) {
            setError('Could not read layer pixel data.')
            setIsProcessing(false)
            return
        }
        const imageData = layerCtx.getImageData(0, 0, canvasSize.width, canvasSize.height)

        const requestId = Math.random().toString(36).slice(2)

        // Handle worker responses
        const handleMessage = (e: MessageEvent) => {
            const msg = e.data

            if (msg.id !== requestId) return // Different request — ignore

            if (msg.type === 'progress') {
                if (!cancelledRef.current) setProgress(msg.progress as number)
                return
            }

            if (msg.type === 'result') {
                workerRef.current?.removeEventListener('message', handleMessage)

                if (cancelledRef.current) {
                    // User cancelled — discard result
                    setIsProcessing(false)
                    return
                }

                // Build a full-canvas output by compositing the inpainted
                // region back over a copy of the original layer.
                const resultImageData = msg.imageData as ImageData
                const outputCanvas = document.createElement('canvas')
                outputCanvas.width = canvasSize.width
                outputCanvas.height = canvasSize.height
                const outCtx = outputCanvas.getContext('2d')!

                // Draw original layer first
                outCtx.drawImage(activeLayer.data!, 0, 0)

                // Composite filled pixels from the result, constrained to mask
                const composite = outCtx.getImageData(0, 0, canvasSize.width, canvasSize.height)
                for (let i = 0; i < mask.data.length; i += 4) {
                    if (mask.data[i] > 128) {
                        composite.data[i]     = resultImageData.data[i]
                        composite.data[i + 1] = resultImageData.data[i + 1]
                        composite.data[i + 2] = resultImageData.data[i + 2]
                        composite.data[i + 3] = resultImageData.data[i + 3]
                    }
                }
                outCtx.putImageData(composite, 0, 0)

                // Add as new layer — exactly like GenFillModal
                addLayer('Content-Aware Fill', outputCanvas)
                setCAFModalOpen(false)
                setIsProcessing(false)
                return
            }

            if (msg.type === 'error') {
                workerRef.current?.removeEventListener('message', handleMessage)
                console.error('[CAF Worker]', msg.message)
                setError(msg.message ?? 'Fill failed. Make sure the WASM module is built.')
                setIsProcessing(false)
            }
        }

        workerRef.current.addEventListener('message', handleMessage)

        // Dispatch fill request to worker
        workerRef.current.postMessage({
            type: 'fill',
            id: requestId,
            imageData,
            maskData: mask,
            options: { patchSize: 9, iterations: 4 },
        })
    }, [selection, layers, activeLayerId, canvasSize, addLayer, setCAFModalOpen])

    const handleCancel = useCallback(() => {
        cancelledRef.current = true
        setIsProcessing(false)
        setError(null)
        setProgress(0)
        setCAFModalOpen(false)
    }, [setCAFModalOpen])

    // -------------------------------------------------------------------------
    // Selection preview dimensions (same as GenFillModal)
    // -------------------------------------------------------------------------

    const getPreviewStyle = (): React.CSSProperties => {
        if (!selection || selection.width === 0 || selection.height === 0) {
            return { width: 260, height: 60 }
        }
        const ratio = selection.width / selection.height
        const maxW = 260
        const maxH = 120
        let w = maxW
        let h = w / ratio
        if (h > maxH) { h = maxH; w = h * ratio }
        return { width: Math.round(w), height: Math.round(h) }
    }

    const previewStyle = getPreviewStyle()

    // -------------------------------------------------------------------------
    // Preview canvas — draws the selected image region so the user can see
    // exactly what will be filled, rather than just an empty placeholder box.
    // -------------------------------------------------------------------------

    useEffect(() => {
        const canvas = previewCanvasRef.current
        if (!canvas || !selection) return

        const activeLayer = layers.find(l => l.id === activeLayerId)
        if (!activeLayer?.data) return

        // Draw the cropped selection region from the active layer into the
        // preview canvas, scaling it to fit within previewStyle dimensions.
        const pw = (previewStyle.width as number) || 260
        const ph = (previewStyle.height as number) || 60
        canvas.width  = pw
        canvas.height = ph

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Checkerboard background to indicate transparent areas
        const tileSize = 8
        for (let y = 0; y < ph; y += tileSize) {
            for (let x = 0; x < pw; x += tileSize) {
                ctx.fillStyle = ((x / tileSize + y / tileSize) % 2 === 0)
                    ? '#cccccc' : '#ffffff'
                ctx.fillRect(x, y, tileSize, tileSize)
            }
        }

        // Blit the selection region from the layer canvas
        ctx.drawImage(
            activeLayer.data,
            selection.x, selection.y, selection.width, selection.height,
            0, 0, pw, ph
        )

        // Ellipse clip mask if the selection shape is elliptical
        if (selection.type === 'ellipse') {
            ctx.globalCompositeOperation = 'destination-in'
            ctx.beginPath()
            ctx.ellipse(pw / 2, ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalCompositeOperation = 'source-over'
        }
    }, [selection, layers, activeLayerId, previewStyle.width, previewStyle.height])

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
        <div
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: MODAL_WIDTH,
                zIndex: 9999,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-main)',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
                overflow: 'visible',
                fontFamily: 'inherit',
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
        >
            {/* Upward caret — border layer */}
            <div style={{
                position: 'absolute',
                top: -8,
                left: position.caretOffset - 8,
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid var(--border-main)',
                pointerEvents: 'none',
            }} />
            {/* Upward caret — fill layer */}
            <div style={{
                position: 'absolute',
                top: -7,
                left: position.caretOffset - 7,
                width: 0,
                height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '7px solid var(--bg-panel)',
                pointerEvents: 'none',
                zIndex: 1,
            }} />

            {/* ── Header ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px 8px',
                borderBottom: '1px solid var(--border-main)',
            }}>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                }}>
                    <Wand2 size={13} style={{ color: 'var(--accent-active)' }} />
                    Content-Aware Fill
                </span>
                <button
                    onClick={handleCancel}
                    title="Close"
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: 2,
                        display: 'flex', alignItems: 'center', borderRadius: 3,
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: 12 }}>

                {/* Error banner */}
                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                        padding: '6px 10px', marginBottom: 10,
                        background: 'rgba(255,80,80,0.1)',
                        border: '1px solid rgba(255,80,80,0.3)',
                        borderRadius: 4, fontSize: 11, color: '#ff5050',
                    }}>
                        <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                        {error}
                    </div>
                )}

                {/* Selection preview / progress area */}
                <div style={{
                    borderRadius: 5,
                    overflow: 'hidden',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-2)',
                    marginBottom: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    gap: 8,
                    minHeight: 60,
                }}>
                    {/* Selection size info */}
                    {selection && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Selection: {Math.round(selection.width)} × {Math.round(selection.height)} px
                        </span>
                    )}

                    {/* Selection region preview — renders the actual image pixels
                        from the active layer, cropped to the selection bounds.   */}
                    <canvas
                        ref={previewCanvasRef}
                        style={{
                            ...previewStyle,
                            borderRadius: selection?.type === 'ellipse' ? '50%' : 4,
                            border: '1px solid var(--border-main)',
                            opacity: isProcessing ? 0.5 : 1,
                            transition: 'opacity 0.2s',
                            flexShrink: 0,
                            display: 'block',
                            imageRendering: 'pixelated',
                        }}
                    />

                    {/* Progress bar */}
                    {isProcessing && (
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}>
                            <div style={{
                                width: '100%',
                                height: 4,
                                background: 'var(--bg-2)',
                                borderRadius: 2,
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${Math.round(progress * 100)}%`,
                                    height: '100%',
                                    background: 'var(--accent-active)',
                                    transition: 'width 0.15s ease',
                                    borderRadius: 2,
                                }} />
                            </div>
                            <span style={{
                                fontSize: 10,
                                color: 'var(--text-secondary)',
                                textAlign: 'center',
                            }}>
                                {progress < 0.2
                                    ? 'Loading algorithm…'
                                    : progress < 0.9
                                    ? 'Synthesizing texture…'
                                    : 'Finalising…'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Info hint */}
                {!isProcessing && !error && (
                    <p style={{
                        margin: '0 0 10px',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                    }}>
                        Fills the selection with synthesised content using PatchMatch.
                        Runs entirely on-device — no internet required.
                    </p>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleCancel}
                        disabled={isProcessing}
                        style={{
                            padding: '6px 12px', borderRadius: 4, fontSize: 11,
                            border: '1px solid var(--border-main)', background: 'var(--bg-input)',
                            color: 'var(--text-primary)', cursor: isProcessing ? 'default' : 'pointer',
                            fontWeight: 500, opacity: isProcessing ? 0.5 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleFill}
                        disabled={isProcessing || !selection}
                        style={{
                            padding: '6px 14px', borderRadius: 4, fontSize: 11,
                            border: 'none', background: 'var(--accent-active)',
                            color: '#fff',
                            cursor: (isProcessing || !selection) ? 'default' : 'pointer',
                            fontWeight: 600,
                            opacity: (isProcessing || !selection) ? 0.7 : 1,
                            display: 'flex', alignItems: 'center', gap: 5,
                        }}
                    >
                        {isProcessing ? (
                            'Processing…'
                        ) : (
                            <><Wand2 size={12} /> Fill</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
