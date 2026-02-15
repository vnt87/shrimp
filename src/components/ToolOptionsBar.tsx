import type { ToolOptions } from '../App'
import { useState, useEffect } from 'react'
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    ZoomIn,
    ZoomOut,
    PenTool,
    MousePointer2,
    Move as MoveIcon,
    Hexagon,
    BoxSelect,
    PaintBucket,
    PenLine,
    Trash2
} from 'lucide-react'
import FontSelector from './FontSelector'
import { useEditor } from './EditorContext'

interface ToolOptionsBarProps {
    activeTool: string
    toolOptions: ToolOptions
    onToolOptionChange: <K extends keyof ToolOptions>(key: K, value: ToolOptions[K]) => void
}

const toolLabels: Record<string, string> = {
    'move': 'Move',
    'crop': 'Crop',
    'rect-select': 'Rectangle Select',
    'ellipse-select': 'Ellipse Select',
    'lasso-select': 'Lasso Select',
    'wand-select': 'Magic Wand',
    'brush': 'Paintbrush',
    'pencil': 'Pencil',
    'eraser': 'Eraser',
    'bucket': 'Bucket Fill',
    'picker': 'Color Picker',
    'text': 'Text',
    'zoom': 'Zoom',
    'paths': 'Paths',
}

export default function ToolOptionsBar({ activeTool, toolOptions, onToolOptionChange }: ToolOptionsBarProps) {
    const {
        activePath,
        setActivePath,
        setSelection,
        layers,
        activeLayerId,
        updateLayerData,
        foregroundColor
    } = useEditor()

    const label = toolLabels[activeTool] || activeTool
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

    const renderSlider = (
        key: keyof ToolOptions,
        labelText: string,
        min: number,
        max: number,
        step: number = 1,
        unit: string = ''
    ) => {
        const value = toolOptions[key] as number
        const range = max - min
        const fill = range > 0 ? ((value - min) / range) * 100 : 0
        const fillPercent = Math.min(100, Math.max(0, fill))

        return (
            <div className="tool-options-slider-group" key={key}>
                <span className="slider-label">{labelText}</span>
                <input
                    type="range"
                    className="tool-options-slider"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    style={{
                        background: `linear-gradient(to right, var(--accent-active) 0%, var(--accent-active) ${fillPercent}%, var(--bg-input) ${fillPercent}%, var(--bg-input) 100%)`
                    }}
                    onChange={(e) => onToolOptionChange(key, Number(e.target.value) as ToolOptions[typeof key])}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        type="number"
                        className="tool-options-number-input"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v)) onToolOptionChange(key, Math.min(max, Math.max(min, v)) as ToolOptions[typeof key])
                        }}
                    />
                    {unit && <span className="slider-unit">{unit}</span>}
                </div>
            </div>
        )
    }

    const renderBrushOptions = () => (
        <>
            {renderSlider('brushSize', 'Size', 1, 200, 1, 'px')}
            <div className="tool-options-divider" />
            {renderSlider('brushOpacity', 'Opacity', 1, 100, 1, '%')}
            <div className="tool-options-divider" />
            {renderSlider('brushHardness', 'Hardness', 0, 100, 1, '%')}
        </>
    )

    const renderEraserOptions = () => (
        <>
            {renderSlider('brushSize', 'Size', 1, 200, 1, 'px')}
            <div className="tool-options-divider" />
            {renderSlider('brushOpacity', 'Opacity', 1, 100, 1, '%')}
        </>
    )

    const renderBucketOptions = () => (
        <>
            {renderSlider('fillThreshold', 'Threshold', 0, 255, 1, '')}
            <div className="tool-options-divider" />
            {renderSlider('bucketOpacity', 'Opacity', 0, 100, 1, '%')}
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">Fill</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button
                        className={`pref-btn ${toolOptions.bucketFillType === 'fg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('bucketFillType', 'fg')}
                        title="FG Color Fill"
                    >
                        FG
                    </button>
                    <button
                        className={`pref-btn ${toolOptions.bucketFillType === 'bg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('bucketFillType', 'bg')}
                        title="BG Color Fill"
                    >
                        BG
                    </button>
                </div>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">Area</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.bucketAffectedArea}
                    onChange={(e) => onToolOptionChange('bucketAffectedArea', e.target.value as any)}
                >
                    <option value="similar">Similar Colors</option>
                    <option value="selection">Whole Selection</option>
                </select>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-checkbox-group">
                <input
                    type="checkbox"
                    id="bucketSampleMerged"
                    checked={toolOptions.bucketSampleMerged}
                    onChange={(e) => onToolOptionChange('bucketSampleMerged', e.target.checked)}
                />
                <label htmlFor="bucketSampleMerged">Sample Merged</label>
            </div>
        </>
    )

    const renderCropOptions = () => (
        <>
            <div className="tool-options-checkbox-group">
                <input
                    type="checkbox"
                    id="cropDeletePixels"
                    checked={toolOptions.cropDeletePixels}
                    onChange={(e) => onToolOptionChange('cropDeletePixels', e.target.checked)}
                />
                <label htmlFor="cropDeletePixels">Delete cropped pixels</label>
            </div>
            <div className="tool-options-divider" />

            <div className="tool-options-checkbox-group">
                <input
                    type="checkbox"
                    id="cropFixedRatio"
                    checked={toolOptions.cropFixedRatio}
                    onChange={(e) => onToolOptionChange('cropFixedRatio', e.target.checked)}
                />
                <label htmlFor="cropFixedRatio">Fixed Aspect Ratio</label>
            </div>

            {toolOptions.cropFixedRatio && (
                <div className="tool-options-slider-group" style={{ marginLeft: 8 }}>
                    <span className="slider-label">Ratio</span>
                    <input
                        type="number"
                        className="tool-options-number-input"
                        style={{ width: 60, height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4, paddingLeft: 4 }}
                        value={toolOptions.cropAspectRatio}
                        step={0.1}
                        min={0.1}
                        onChange={(e) => onToolOptionChange('cropAspectRatio', parseFloat(e.target.value))}
                    />
                </div>
            )}

            <div className="tool-options-divider" />

            {renderSlider('cropHighlightOpacity', 'Highlight', 0, 100, 1, '%')}

            <div className="tool-options-divider" />

            <div className="tool-options-slider-group">
                <span className="slider-label">Guides</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.cropGuides}
                    onChange={(e) => onToolOptionChange('cropGuides', e.target.value as any)}
                >
                    <option value="none">No guides</option>
                    <option value="center">Center lines</option>
                    <option value="thirds">Rule of thirds</option>
                    <option value="fifth">Rule of fifths</option>
                </select>
            </div>
        </>
    )

    const renderPickerOptions = () => {
        const effectiveTarget = isCmdPressed
            ? (toolOptions.pickerTarget === 'fg' ? 'bg' : 'fg')
            : (toolOptions.pickerTarget || 'fg')

        return (
            <>
                <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="slider-label">Target</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                        <button
                            className={`pref-btn ${effectiveTarget === 'fg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                            style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                            onClick={() => onToolOptionChange('pickerTarget', 'fg')}
                            title="Set Foreground Color"
                        >
                            Set FG
                        </button>
                        <button
                            className={`pref-btn ${effectiveTarget === 'bg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                            style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                            onClick={() => onToolOptionChange('pickerTarget', 'bg')}
                            title="Set Background Color"
                        >
                            Set BG
                        </button>
                    </div>
                </div>
                <div className="tool-options-divider" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: 4 }}>
                    Hold Cmd/Ctrl to toggle
                </span>
            </>
        )
    }

    const renderTextOptions = () => (
        <>
            {renderSlider('fontSize', 'Size', 8, 200, 1, 'px')}
            <div className="tool-options-divider" />
            <div className="tool-options-slider-group">
                <span className="slider-label">Color</span>
                <input
                    type="color"
                    className="tool-options-color"
                    style={{ width: 100, height: 24, padding: 0, border: 'none' }}
                    value={toolOptions.textColor}
                    onChange={(e) => onToolOptionChange('textColor', e.target.value)}
                />
                <button
                    className="pref-btn pref-btn-secondary"
                    style={{ height: 24, fontSize: 10, padding: '0 6px', minWidth: 'auto' }}
                    onClick={() => onToolOptionChange('textColor', foregroundColor)}
                    title="Use foreground color"
                >
                    FG
                </button>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-slider-group">
                <span className="slider-label">Font</span>
                <FontSelector
                    value={toolOptions.fontFamily}
                    onChange={(font) => onToolOptionChange('fontFamily', font)}
                />
            </div>
            <div className="tool-options-divider" />

            {/* Alignment */}
            <div className="tool-options-group" style={{ display: 'flex', gap: 2 }}>
                {[
                    { value: 'left', icon: AlignLeft, label: 'Left' },
                    { value: 'center', icon: AlignCenter, label: 'Center' },
                    { value: 'right', icon: AlignRight, label: 'Right' },
                    { value: 'justify', icon: AlignJustify, label: 'Justified' }
                ].map(align => (
                    <button
                        key={align.value}
                        className={`pref-btn ${toolOptions.textAlign === align.value ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => onToolOptionChange('textAlign', align.value as any)}
                        title={align.label}
                    >
                        <align.icon size={14} />
                    </button>
                ))}
            </div>

            <div className="tool-options-divider" />

            {/* Style: Bold, Italic, Underline, Strikethrough */}
            <div className="tool-options-group" style={{ display: 'flex', gap: 2 }}>
                <button
                    className={`pref-btn ${toolOptions.textBold ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textBold', !toolOptions.textBold)}
                    title="Bold"
                >
                    <Bold size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textItalic ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textItalic', !toolOptions.textItalic)}
                    title="Italic"
                >
                    <Italic size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textUnderline ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textUnderline', !toolOptions.textUnderline)}
                    title="Underline"
                >
                    <Underline size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textStrikethrough ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textStrikethrough', !toolOptions.textStrikethrough)}
                    title="Strikethrough"
                >
                    <Strikethrough size={14} />
                </button>
            </div>

            <div className="tool-options-divider" />

            {renderSlider('textLetterSpacing', 'Spacing', -10, 50, 1, 'px')}

            <div className="tool-options-divider" />

            {renderSlider('textLineHeight', 'Line H', 0.5, 3, 0.1, '×')}
        </>
    )

    const renderZoomOptions = () => {
        const effectiveDirection = isCmdPressed
            ? (toolOptions.zoomDirection === 'in' ? 'out' : 'in')
            : (toolOptions.zoomDirection || 'in')

        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', height: 24, background: 'var(--bg-input)', borderRadius: 4, padding: 2 }}>
                    <button
                        className={effectiveDirection === 'in' ? 'tool-option-button active' : 'tool-option-button'}
                        style={{
                            height: '100%',
                            padding: '0 8px',
                            borderRadius: 2,
                            border: 'none',
                            background: effectiveDirection === 'in' ? 'var(--accent-active)' : 'transparent',
                            color: effectiveDirection === 'in' ? 'white' : 'var(--text-secondary)',
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                        onClick={() => onToolOptionChange('zoomDirection', 'in')}
                        title="Zoom In"
                    >
                        <ZoomIn size={14} />
                        <span>In</span>
                    </button>
                    <button
                        className={effectiveDirection === 'out' ? 'tool-option-button active' : 'tool-option-button'}
                        style={{
                            height: '100%',
                            padding: '0 8px',
                            borderRadius: 2,
                            border: 'none',
                            background: effectiveDirection === 'out' ? 'var(--accent-active)' : 'transparent',
                            color: effectiveDirection === 'out' ? 'white' : 'var(--text-secondary)',
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                        onClick={() => onToolOptionChange('zoomDirection', 'out')}
                        title="Zoom Out"
                    >
                        <ZoomOut size={14} />
                        <span>Out</span>
                    </button>
                </div>
                <div className="tool-options-divider" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: 4 }}>
                    Hold Cmd/Ctrl to toggle
                </span>
            </>
        )
    }

    // Sample a cubic Bézier curve into discrete points
    const sampleCubicBezier = (
        p0x: number, p0y: number,
        cp1x: number, cp1y: number,
        cp2x: number, cp2y: number,
        p1x: number, p1y: number,
        steps: number
    ): { x: number; y: number }[] => {
        const pts: { x: number; y: number }[] = []
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const mt = 1 - t
            pts.push({
                x: mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p1x,
                y: mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p1y
            })
        }
        return pts
    }

    // Sample a quadratic Bézier curve into discrete points
    const sampleQuadBezier = (
        p0x: number, p0y: number,
        cpx: number, cpy: number,
        p1x: number, p1y: number,
        steps: number
    ): { x: number; y: number }[] => {
        const pts: { x: number; y: number }[] = []
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const mt = 1 - t
            pts.push({
                x: mt * mt * p0x + 2 * mt * t * cpx + t * t * p1x,
                y: mt * mt * p0y + 2 * mt * t * cpy + t * t * p1y
            })
        }
        return pts
    }

    const handleSelectionFromPath = () => {
        if (!activePath || activePath.points.length < 2) return

        const SAMPLE_STEPS = 20
        const points: { x: number, y: number }[] = [{ x: activePath.points[0].x, y: activePath.points[0].y }]

        // Sample each segment
        for (let i = 1; i < activePath.points.length; i++) {
            const p1 = activePath.points[i - 1]
            const p2 = activePath.points[i]

            if (p1.handleOut && p2.handleIn) {
                points.push(...sampleCubicBezier(p1.x, p1.y, p1.handleOut.x, p1.handleOut.y, p2.handleIn.x, p2.handleIn.y, p2.x, p2.y, SAMPLE_STEPS))
            } else if (p1.handleOut) {
                points.push(...sampleQuadBezier(p1.x, p1.y, p1.handleOut.x, p1.handleOut.y, p2.x, p2.y, SAMPLE_STEPS))
            } else if (p2.handleIn) {
                points.push(...sampleQuadBezier(p1.x, p1.y, p2.handleIn.x, p2.handleIn.y, p2.x, p2.y, SAMPLE_STEPS))
            } else {
                points.push({ x: p2.x, y: p2.y })
            }
        }

        // Handle closing segment for closed paths
        if (activePath.closed && activePath.points.length > 2) {
            const end = activePath.points[activePath.points.length - 1]
            const start = activePath.points[0]
            if (end.handleOut && start.handleIn) {
                points.push(...sampleCubicBezier(end.x, end.y, end.handleOut.x, end.handleOut.y, start.handleIn.x, start.handleIn.y, start.x, start.y, SAMPLE_STEPS))
            } else {
                points.push({ x: start.x, y: start.y })
            }
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        points.forEach(p => {
            minX = Math.min(minX, p.x)
            minY = Math.min(minY, p.y)
            maxX = Math.max(maxX, p.x)
            maxY = Math.max(maxY, p.y)
        })

        setSelection({
            type: 'path',
            path: points,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        })
    }

    const drawPathOnContext = (ctx: CanvasRenderingContext2D, path: NonNullable<typeof activePath>, layerOffset: { x: number; y: number }) => {
        const toLocal = (p: { x: number; y: number }) => ({
            x: p.x - layerOffset.x,
            y: p.y - layerOffset.y
        })

        const p0 = toLocal(path.points[0])
        ctx.moveTo(p0.x, p0.y)

        for (let i = 1; i < path.points.length; i++) {
            const p1 = path.points[i - 1]
            const p2 = path.points[i]
            const p2Local = toLocal(p2)
            const p1HandleOutLocal = p1.handleOut ? toLocal(p1.handleOut) : null
            const p2HandleInLocal = p2.handleIn ? toLocal(p2.handleIn) : null

            if (p1HandleOutLocal && p2HandleInLocal) {
                ctx.bezierCurveTo(p1HandleOutLocal.x, p1HandleOutLocal.y, p2HandleInLocal.x, p2HandleInLocal.y, p2Local.x, p2Local.y)
            } else if (p1HandleOutLocal) {
                ctx.quadraticCurveTo(p1HandleOutLocal.x, p1HandleOutLocal.y, p2Local.x, p2Local.y)
            } else if (p2HandleInLocal) {
                ctx.quadraticCurveTo(p2HandleInLocal.x, p2HandleInLocal.y, p2Local.x, p2Local.y)
            } else {
                ctx.lineTo(p2Local.x, p2Local.y)
            }
        }

        if (path.closed) {
            const start = toLocal(path.points[0])
            const end = path.points[path.points.length - 1]
            const endHandleOutLocal = end.handleOut ? toLocal(end.handleOut) : null
            const startHandleInLocal = path.points[0].handleIn ? toLocal(path.points[0].handleIn!) : null
            if (endHandleOutLocal && startHandleInLocal) {
                ctx.bezierCurveTo(endHandleOutLocal.x, endHandleOutLocal.y, startHandleInLocal.x, startHandleInLocal.y, start.x, start.y)
            } else {
                ctx.lineTo(start.x, start.y)
            }
            ctx.closePath()
        }
    }

    const handleFillPath = () => {
        if (!activePath || !activeLayerId) return
        const layer = layers.find(l => l.id === activeLayerId)
        if (!layer || !layer.data) return

        const canvas = layer.data
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = foregroundColor
        ctx.beginPath()
        drawPathOnContext(ctx, activePath, { x: layer.x, y: layer.y })

        ctx.fill()
        updateLayerData(activeLayerId, canvas)
    }

    const handleStrokePath = () => {
        if (!activePath || !activeLayerId) return
        const layer = layers.find(l => l.id === activeLayerId)
        if (!layer || !layer.data) return

        const canvas = layer.data
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.strokeStyle = foregroundColor
        ctx.lineWidth = toolOptions.brushSize // Use brush size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        drawPathOnContext(ctx, activePath, { x: layer.x, y: layer.y })

        ctx.stroke()
        updateLayerData(activeLayerId, canvas)
    }

    const renderPathOptions = () => (
        <>
            <div className="tool-options-group">
                <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 6, gap: 2 }}>
                    {[
                        { mode: 'design', icon: PenTool, label: 'Design' },
                        { mode: 'edit', icon: MousePointer2, label: 'Edit' },
                        { mode: 'move', icon: MoveIcon, label: 'Move' }
                    ].map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => onToolOptionChange('pathMode', mode as any)}
                            title={`${label} Mode`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                background: toolOptions.pathMode === mode ? 'var(--bg-hover)' : 'transparent',
                                color: toolOptions.pathMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                                borderRadius: 4,
                                border: 'none',
                                fontSize: 12,
                                fontWeight: toolOptions.pathMode === mode ? 500 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.1s ease',
                                boxShadow: toolOptions.pathMode === mode ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            <Icon size={14} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="tool-options-divider" />

            <div className="tool-options-group">
                <button
                    className={`pref-btn ${toolOptions.pathPolygonal ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    onClick={() => onToolOptionChange('pathPolygonal', !toolOptions.pathPolygonal)}
                    title="Polygonal (Straight lines)"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 26,
                        padding: '0 8px',
                        gap: 6,
                        fontSize: 12,
                        borderRadius: 4
                    }}
                >
                    <Hexagon size={14} />
                    <span>Polygonal</span>
                </button>
            </div>

            <div className="tool-options-divider" />

            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 4, padding: 2, gap: 1 }}>
                    <button
                        onClick={handleSelectionFromPath}
                        title="Selection from Path"
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: activePath ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: activePath ? 'pointer' : 'default', opacity: activePath ? 1 : 0.5 }}
                    >
                        <BoxSelect size={15} />
                    </button>
                    <button
                        onClick={handleFillPath}
                        title="Fill Path"
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: activePath && activeLayerId ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: activePath && activeLayerId ? 'pointer' : 'default', opacity: activePath && activeLayerId ? 1 : 0.5 }}
                    >
                        <PaintBucket size={15} />
                    </button>
                    <button
                        onClick={handleStrokePath}
                        title="Stroke Path"
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: activePath && activeLayerId ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: activePath && activeLayerId ? 'pointer' : 'default', opacity: activePath && activeLayerId ? 1 : 0.5 }}
                    >
                        <PenLine size={15} />
                    </button>
                </div>

                <div style={{ width: 1, height: 16, background: 'var(--border-main)' }} />

                <button
                    onClick={() => setActivePath(null)}
                    title="Clear Path"
                    style={{
                        height: 24,
                        width: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--pref-close-hover)',
                        cursor: 'pointer',
                        opacity: activePath ? 1 : 0.5
                    }}
                    disabled={!activePath}
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </>
    )

    const renderToolSpecificOptions = () => {
        switch (activeTool) {
            case 'brush':
            case 'pencil':
                return renderBrushOptions()
            case 'eraser':
                return renderEraserOptions()
            case 'bucket':
            case 'wand-select':
                return renderBucketOptions()
            case 'text':
                return renderTextOptions()
            case 'picker':
                return renderPickerOptions()
            case 'crop':
                return renderCropOptions()
            case 'zoom':
                return renderZoomOptions()
            case 'paths':
                return renderPathOptions()
            case 'lasso-select':
            case 'rect-select':
            case 'ellipse-select':
                // Maybe add antialiasing toggle later
                return (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Selection tools
                    </span>
                )
            default:
                return (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No options for this tool
                    </span>
                )
        }
    }

    return (
        <div className="tool-options">
            <div className="tool-options-group">
                <span className="tool-options-label" style={{ fontWeight: 600 }}>{label}</span>
            </div>
            <div className="tool-options-divider" />
            {renderToolSpecificOptions()}
        </div>
    )
}
