import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, X, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { useEditor } from './EditorContext'
import { AIService } from '../services/AIService'
import ImageLoader from './ImageLoader'

/**
 * Photoshop-style floating Generative Fill prompt panel.
 *
 * Behaviour:
 *  - Appears anchored below (or above) the active selection marching-ants box
 *  - Optional text prompt; empty prompt uses a built-in context-fill system prompt
 *  - Loading state: ImageLoader blinking grid over the selection aspect ratio
 *  - Result state: ImageLoader pixel-reveal transition + Accept / Try Again
 *  - On accept: composites the generated image clipped to the selection shape
 *    and adds it as a new layer; selection remains active
 */
export default function GenFillModal() {
    const {
        selection,
        canvasSize,
        viewTransform,
        setGenFillModalOpen,
        addLayer,
    } = useEditor()

    // --- local state ---
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [position, setPosition] = useState({ x: 0, y: 0, caretOffset: 160 })

    const MODAL_WIDTH = 320

    /**
     * System prompt prepended to every request so empty prompts still produce
     * contextually appropriate inpainting results.
     */
    const SYSTEM_PROMPT_PREFIX =
        'Generative fill: seamlessly fill the selected region so it blends naturally ' +
        'with the surrounding image content. Match the lighting, texture, and colour palette.'

    /**
     * Pick the nearest supported API image size based on the selection aspect ratio.
     * Supported sizes: 1024×1024, 1344×768, 768×1344.
     */
    const pickApiSize = (w: number, h: number): string => {
        if (!w || !h) return '1024x1024'
        const ratio = w / h
        if (ratio > 1.2) return '1344x768'
        if (ratio < 1 / 1.2) return '768x1344'
        return '1024x1024'
    }

    /**
     * Recalculate the modal's fixed screen position whenever the selection or
     * viewTransform changes.  Queries the `.canvas-viewport` element for its
     * bounding rect so we can convert canvas coords → screen coords.
     */
    useEffect(() => {
        if (!selection) return

        const vpEl = document.querySelector('.canvas-viewport') as HTMLElement | null
        const vpRect = vpEl?.getBoundingClientRect() ?? { left: 0, top: 0 }

        // Bottom-centre of the selection in screen space
        const selCentreX =
            vpRect.left +
            viewTransform.offsetX +
            (selection.x + selection.width / 2) * viewTransform.scale

        const selBottomY =
            vpRect.top +
            viewTransform.offsetY +
            (selection.y + selection.height) * viewTransform.scale +
            12 // gap below selection

        const MODAL_APPROX_H = 220
        const GAP = 8
        const winW = window.innerWidth
        const winH = window.innerHeight

        // Horizontal: centre on selection, clamp to viewport
        let left = selCentreX - MODAL_WIDTH / 2
        left = Math.max(GAP, Math.min(winW - MODAL_WIDTH - GAP, left))

        // Caret horizontal offset relative to modal left edge
        const caretOffset = Math.max(16, Math.min(MODAL_WIDTH - 32, selCentreX - left))

        // Vertical: prefer below, flip above if not enough room
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

    /** Run the AI generation with system prompt + user prompt. */
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true)
        setError(null)
        setGeneratedUrl(null)

        try {
            const targetW = selection ? selection.width : canvasSize.width
            const targetH = selection ? selection.height : canvasSize.height
            const apiSize = pickApiSize(targetW, targetH)

            // Always include the system context; append user prompt if provided
            const fullPrompt = prompt.trim()
                ? `${SYSTEM_PROMPT_PREFIX} ${prompt.trim()}`
                : SYSTEM_PROMPT_PREFIX

            const url = await AIService.generateImage(fullPrompt, apiSize)
            setGeneratedUrl(url)
        } catch (e: unknown) {
            console.error('[GenFillModal] Generation failed:', e)
            setError(
                e instanceof Error
                    ? e.message
                    : 'Generation failed. Check your AI settings.'
            )
        } finally {
            setIsGenerating(false)
        }
    }, [prompt, selection, canvasSize])

    /**
     * Composite the generated image onto a canvas-sized layer, clipped to the
     * current selection shape (rect / ellipse / path), then add it as a new layer.
     */
    const handleAccept = useCallback(async () => {
        if (!generatedUrl) return

        try {
            const img = new window.Image()
            img.crossOrigin = 'Anonymous'
            img.src = generatedUrl
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = () => reject(new Error('Failed to load generated image'))
            })

            const outputCanvas = document.createElement('canvas')
            outputCanvas.width = canvasSize.width
            outputCanvas.height = canvasSize.height
            const ctx = outputCanvas.getContext('2d')
            if (!ctx) throw new Error('Could not get canvas context')

            if (selection && selection.width > 0 && selection.height > 0) {
                ctx.save()
                // Clip to the exact selection shape
                ctx.beginPath()
                if (selection.type === 'ellipse') {
                    const rx = selection.width / 2
                    const ry = selection.height / 2
                    ctx.ellipse(
                        selection.x + rx,
                        selection.y + ry,
                        rx, ry,
                        0, 0, Math.PI * 2
                    )
                } else if (
                    selection.type === 'path' &&
                    selection.path &&
                    selection.path.length > 2
                ) {
                    ctx.moveTo(selection.path[0].x, selection.path[0].y)
                    for (let i = 1; i < selection.path.length; i++) {
                        ctx.lineTo(selection.path[i].x, selection.path[i].y)
                    }
                    ctx.closePath()
                } else {
                    // Rect (default)
                    ctx.rect(selection.x, selection.y, selection.width, selection.height)
                }
                ctx.clip()
                ctx.drawImage(img, selection.x, selection.y, selection.width, selection.height)
                ctx.restore()
            } else {
                // No selection — centre and scale-fit to canvas
                const scale = Math.min(
                    canvasSize.width / img.width,
                    canvasSize.height / img.height
                )
                const dw = img.width * scale
                const dh = img.height * scale
                ctx.drawImage(
                    img,
                    (canvasSize.width - dw) / 2,
                    (canvasSize.height - dh) / 2,
                    dw, dh
                )
            }

            // Name layer after prompt (truncated), or generic if none
            const layerName = prompt.trim()
                ? `AI Fill: ${prompt.substring(0, 30)}`
                : 'AI Fill'
            addLayer(layerName, outputCanvas)
            // Close modal — selection remains active
            setGenFillModalOpen(false)
        } catch (e: unknown) {
            console.error('[GenFillModal] Accept failed:', e)
            setError(e instanceof Error ? e.message : 'Failed to apply result.')
        }
    }, [generatedUrl, selection, canvasSize, addLayer, setGenFillModalOpen, prompt])

    const handleClose = () => setGenFillModalOpen(false)

    const handleTryAgain = () => {
        setGeneratedUrl(null)
        setError(null)
    }

    /**
     * Compute ImageLoader preview dimensions based on the selection's aspect ratio,
     * capped to fit within the modal width.
     */
    const getPreviewDimensions = (): { w: number; h: number } => {
        if (!selection || selection.width === 0 || selection.height === 0) {
            return { w: 280, h: 160 }
        }
        const ratio = selection.width / selection.height
        const maxW = 280
        const maxH = 200
        let w = maxW
        let h = w / ratio
        if (h > maxH) { h = maxH; w = h * ratio }
        return { w: Math.round(w), h: Math.round(h) }
    }

    const { w: previewW, h: previewH } = getPreviewDimensions()

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
            // Prevent canvas tool events from firing through the modal
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
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
            {/* Upward caret — fill layer (covers border) */}
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
                    <Sparkles size={13} style={{ color: 'var(--accent-active)' }} />
                    Generative Fill
                </span>
                <button
                    onClick={handleClose}
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

                {/* Optional prompt input */}
                <input
                    type="text"
                    placeholder="Describe what to generate (optional)…"
                    value={prompt}
                    onChange={(e) => { setPrompt(e.target.value); setError(null) }}
                    onKeyDown={(e) => {
                        // Prevent canvas shortcuts from firing while typing
                        e.stopPropagation()
                        if (e.key === 'Enter' && !isGenerating && !generatedUrl) handleGenerate()
                        if (e.key === 'Escape') handleClose()
                    }}
                    disabled={isGenerating || !!generatedUrl}
                    autoFocus
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '7px 10px',
                        borderRadius: 5,
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        marginBottom: 10,
                        outline: 'none',
                        fontFamily: 'inherit',
                    }}
                />

                {/* Error banner */}
                {error && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', marginBottom: 10,
                        background: 'rgba(255,80,80,0.1)',
                        border: '1px solid rgba(255,80,80,0.3)',
                        borderRadius: 4, fontSize: 11, color: '#ff5050',
                    }}>
                        <AlertCircle size={12} />
                        {error}
                    </div>
                )}

                {/* Preview — ImageLoader handles blinking grid (loading) and pixel reveal (result) */}
                {(isGenerating || generatedUrl) && (
                    <div style={{
                        borderRadius: 5,
                        overflow: 'hidden',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-2)',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 80,
                    }}>
                        {/* Wrap in a fixed-size div so ImageLoader infers the grid dimensions */}
                        <div style={{ width: previewW, height: previewH }}>
                            <ImageLoader
                                src={generatedUrl ?? ''}
                                gridSize={16}
                                cellColor="var(--text-secondary)"
                                loadingDelay={0}
                            />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {!generatedUrl ? (
                        /* ── Idle / Generating state ── */
                        <>
                            <button
                                onClick={handleClose}
                                style={{
                                    padding: '6px 12px', borderRadius: 4, fontSize: 11,
                                    border: '1px solid var(--border-main)', background: 'var(--bg-input)',
                                    color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                style={{
                                    padding: '6px 14px', borderRadius: 4, fontSize: 11,
                                    border: 'none', background: 'var(--accent-active)',
                                    color: '#fff',
                                    cursor: isGenerating ? 'default' : 'pointer',
                                    fontWeight: 600,
                                    opacity: isGenerating ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                {isGenerating ? (
                                    'Generating…'
                                ) : (
                                    <><Sparkles size={12} /> Generate</>
                                )}
                            </button>
                        </>
                    ) : (
                        /* ── Result state ── */
                        <>
                            <button
                                onClick={handleTryAgain}
                                style={{
                                    padding: '6px 12px', borderRadius: 4, fontSize: 11,
                                    border: '1px solid var(--border-main)', background: 'var(--bg-input)',
                                    color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500,
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                <RotateCcw size={11} /> Try Again
                            </button>
                            <button
                                onClick={handleAccept}
                                style={{
                                    padding: '6px 14px', borderRadius: 4, fontSize: 11,
                                    border: 'none', background: 'var(--accent-active)',
                                    color: '#fff', cursor: 'pointer', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}
                            >
                                <Check size={12} /> Add to Canvas
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
