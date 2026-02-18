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
    Trash2,
    Blend,
    Loader2,
    Sparkles
} from 'lucide-react'
import FontSelector from './FontSelector'
import { createFilledPathCanvas, createStrokedPathCanvas, pathToSelectionPolygon } from '../path/rasterize'
import { useLanguage } from '../i18n/LanguageContext'
import { AIService } from '../services/AIService'

interface ToolOptionsBarProps {
    activeTool: string
    toolOptions: ToolOptions
    onToolOptionChange: <K extends keyof ToolOptions>(key: K, value: ToolOptions[K]) => void
}

import { useEditor } from './EditorContext'
import { usePresets } from './PresetsContext'

export default function ToolOptionsBar({ activeTool, toolOptions, onToolOptionChange }: ToolOptionsBarProps) {
    const {
        activePath,
        activePathId,
        setSelection,
        addLayer,
        deletePath,
        foregroundColor,
        canvasSize,
        layers,
        activeGradient,
        selection
    } = useEditor()
    const { t } = useLanguage()

    const toolLabels: Record<string, string> = {
        'move': t('tool.move'),
        'crop': t('tool.crop'),
        'rect-select': t('tool.rect_select'),
        'ellipse-select': t('tool.ellipse_select'),
        'lasso-select': t('tool.lasso_select'),
        'wand-select': t('tool.wand_select'),
        'brush': t('tool.brush'),
        'pencil': t('tool.pencil'),
        'eraser': t('tool.eraser'),
        'bucket': t('tool.bucket'),
        'gradient': t('tool.gradient'),
        'picker': t('tool.picker'),
        'text': t('tool.text'),
        'zoom': t('tool.zoom'),
        'paths': t('tool.paths'),
        'clone': t('tool.clone'),
        'gen-fill': t('tool.gen_fill'),
    }

    const label = toolLabels[activeTool] || activeTool
    const [isCmdPressed, setIsCmdPressed] = useState(false)
    const [genPrompt, setGenPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    const {
        brushPresets, addBrushPreset,
        textStylePresets, addTextStylePreset
    } = usePresets()

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

    const handleSaveBrushPreset = () => {
        const name = prompt(t('tooloptions.enter_preset_name'), `Brush ${brushPresets.length + 1}`)
        if (name) {
            addBrushPreset({
                name,
                size: toolOptions.brushSize,
                opacity: toolOptions.brushOpacity,
                hardness: toolOptions.brushHardness,
                spacing: 1
            })
        }
    }

    const renderBrushOptions = () => (
        <>
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                    className="tool-options-select"
                    style={{ maxWidth: 100, height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    onChange={(e) => {
                        const preset = brushPresets.find(p => p.id === e.target.value)
                        if (preset) {
                            onToolOptionChange('brushSize', preset.size)
                            onToolOptionChange('brushOpacity', preset.opacity)
                            onToolOptionChange('brushHardness', preset.hardness)
                        }
                        e.target.value = '' // Reset selection
                    }}
                    value=""
                >
                    <option value="" disabled>{t('tooloptions.presets')}</option>
                    {brushPresets.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <button
                    className="pref-btn pref-btn-secondary"
                    style={{ height: 24, fontSize: 12, padding: '0 6px' }}
                    onClick={handleSaveBrushPreset}
                    title={t('tooloptions.save_brush_preset_hint')}
                >
                    +
                </button>
            </div>
            <div className="tool-options-divider" />
            {renderSlider('brushSize', t('tooloptions.size'), 1, 200, 1, 'px')}
            <div className="tool-options-divider" />
            {renderSlider('brushOpacity', t('tooloptions.opacity'), 1, 100, 1, '%')}
            <div className="tool-options-divider" />
            {renderSlider('brushHardness', t('tooloptions.hardness'), 0, 100, 1, '%')}
        </>
    )

    const renderEraserOptions = () => (
        <>
            {renderSlider('brushSize', t('tooloptions.size'), 1, 200, 1, 'px')}
            <div className="tool-options-divider" />
            {renderSlider('brushOpacity', t('tooloptions.opacity'), 1, 100, 1, '%')}
        </>
    )

    const renderCloneOptions = () => (
        <>
            {renderBrushOptions()}
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.sample')}</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.cloneSampleMode}
                    onChange={(e) => onToolOptionChange('cloneSampleMode', e.target.value as any)}
                >
                    <option value="current">{t('tooloptions.sample.current')}</option>
                    <option value="all">{t('tooloptions.sample.all')}</option>
                </select>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.target')}</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.cloneTarget}
                    onChange={(e) => onToolOptionChange('cloneTarget', e.target.value as any)}
                >
                    <option value="active">{t('tooloptions.target.active')}</option>
                    <option value="new">{t('tooloptions.target.new')}</option>
                </select>
            </div>
        </>
    )

    const renderBucketOptions = () => (
        <>
            {renderSlider('fillThreshold', t('tooloptions.threshold'), 0, 255, 1, '')}
            <div className="tool-options-divider" />
            {renderSlider('bucketOpacity', t('tooloptions.opacity'), 0, 100, 1, '%')}
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.fill_type')}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button
                        className={`pref-btn ${toolOptions.bucketFillType === 'fg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('bucketFillType', 'fg')}
                        title={t('tooloptions.fill_fg_hint')}
                    >
                        {t('tooloptions.fill_fg')}
                    </button>
                    <button
                        className={`pref-btn ${toolOptions.bucketFillType === 'bg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('bucketFillType', 'bg')}
                        title={t('tooloptions.fill_bg_hint')}
                    >
                        {t('tooloptions.fill_bg')}
                    </button>
                </div>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.area')}</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.bucketAffectedArea}
                    onChange={(e) => onToolOptionChange('bucketAffectedArea', e.target.value as any)}
                >
                    <option value="similar">{t('tooloptions.area.similar')}</option>
                    <option value="selection">{t('tooloptions.area.selection')}</option>
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
                <label htmlFor="bucketSampleMerged">{t('tooloptions.sample_merged')}</label>
            </div>
        </>
    )


    const renderGradientOptions = () => (
        <>
            <div className={`tool-options-group ${!activeGradient ? 'opacity-50 grayscale' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                    className="w-24 h-6 border border-gray-600 rounded overflow-hidden cursor-pointer relative group"
                    title={activeGradient?.name || 'No gradient selected'}
                // Could add onClick to open Gradient Panel?
                >
                    {activeGradient ? (
                        <canvas
                            width={96}
                            height={24}
                            className="w-full h-full"
                            style={{ display: 'block' }}
                            ref={canvas => {
                                if (canvas && activeGradient) {
                                    const ctx = canvas.getContext('2d')
                                    if (ctx) {
                                        // Quick simple preview render
                                        // Ideally cache this or reuse generation util
                                        // For now let's just use linear gradient approximation for UI
                                        // const grad = ctx.createLinearGradient(0, 0, canvas.width, 0)
                                        // Since we have complex gradients, we should use the LUT or evaluate
                                        // But for small preview, maybe just a few stops?
                                        // Or better: use generateGradientLUT and putImageData
                                        import('../utils/gradientMath').then(({ generateGradientLUT }) => {
                                            const lut = generateGradientLUT(activeGradient, canvas.width)
                                            const imgData = ctx.createImageData(canvas.width, 1)
                                            for (let i = 0; i < canvas.width; i++) {
                                                imgData.data[i * 4] = lut[i * 4]
                                                imgData.data[i * 4 + 1] = lut[i * 4 + 1]
                                                imgData.data[i * 4 + 2] = lut[i * 4 + 2]
                                                imgData.data[i * 4 + 3] = lut[i * 4 + 3]
                                            }
                                            // Stretch 1 pixel height to full height
                                            createImageBitmap(imgData).then(bitmap => {
                                                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
                                            })
                                        })
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[10px] text-gray-500">None</div>
                    )}
                </div>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.gradient.type')}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button
                        className={`pref-btn ${toolOptions.gradientType === 'linear' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('gradientType', 'linear')}
                        title={t('tooloptions.gradient.linear_hint')}
                    >
                        {t('tooloptions.gradient.linear')}
                    </button>
                    <button
                        className={`pref-btn ${toolOptions.gradientType === 'radial' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                        onClick={() => onToolOptionChange('gradientType', 'radial')}
                        title={t('tooloptions.gradient.radial_hint')}
                    >
                        {t('tooloptions.gradient.radial')}
                    </button>
                </div>
            </div>

            <div className="tool-options-divider" />

            {renderSlider('gradientOpacity', t('tooloptions.opacity'), 0, 100, 1, '%')}

            <div className="tool-options-divider" />

            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.gradient.direction')}</span>
                <button
                    className={`pref-btn ${toolOptions.gradientReverse ? 'pref-btn-secondary' : 'pref-btn-primary'}`}
                    style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                    onClick={() => onToolOptionChange('gradientReverse', false)}
                    title={t('tooloptions.gradient.fg_bg_hint')}
                >
                    {t('tooloptions.gradient.fg_bg')}
                </button>
                <button
                    className={`pref-btn ${toolOptions.gradientReverse ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                    onClick={() => onToolOptionChange('gradientReverse', true)}
                    title={t('tooloptions.gradient.bg_fg_hint')}
                >
                    {t('tooloptions.gradient.bg_fg')}
                </button>
            </div>

            <div className="tool-options-divider" />

            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="slider-label">{t('tooloptions.area')}</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.gradientAffectedArea}
                    onChange={(e) => onToolOptionChange('gradientAffectedArea', e.target.value as any)}
                >
                    <option value="layer">{t('tooloptions.area.layer')}</option>
                    <option value="selection">{t('tooloptions.area.within_selection')}</option>
                </select>
            </div>

            <div className="tool-options-divider" />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <Blend size={13} />
                {t('tooloptions.gradient.hint')}
            </span>
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
                <label htmlFor="cropDeletePixels">{t('tooloptions.crop.delete_pixels')}</label>
            </div>
            <div className="tool-options-divider" />

            <div className="tool-options-checkbox-group">
                <input
                    type="checkbox"
                    id="cropFixedRatio"
                    checked={toolOptions.cropFixedRatio}
                    onChange={(e) => onToolOptionChange('cropFixedRatio', e.target.checked)}
                />
                <label htmlFor="cropFixedRatio">{t('tooloptions.crop.fixed_ratio')}</label>
            </div>

            {toolOptions.cropFixedRatio && (
                <div className="tool-options-slider-group" style={{ marginLeft: 8 }}>
                    <span className="slider-label">{t('tooloptions.crop.ratio')}</span>
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

            {renderSlider('cropHighlightOpacity', t('tooloptions.crop.highlight'), 0, 100, 1, '%')}

            <div className="tool-options-divider" />

            <div className="tool-options-slider-group">
                <span className="slider-label">{t('tooloptions.crop.guides')}</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.cropGuides}
                    onChange={(e) => onToolOptionChange('cropGuides', e.target.value as any)}
                >
                    <option value="none">{t('tooloptions.crop.guides.none')}</option>
                    <option value="center">{t('tooloptions.crop.guides.center')}</option>
                    <option value="thirds">{t('tooloptions.crop.guides.thirds')}</option>
                    <option value="fifth">{t('tooloptions.crop.guides.fifths')}</option>
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
                    <span className="slider-label">{t('tooloptions.picker.target')}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                        <button
                            className={`pref-btn ${effectiveTarget === 'fg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                            style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                            onClick={() => onToolOptionChange('pickerTarget', 'fg')}
                            title={t('tooloptions.picker.set_fg_hint')}
                        >
                            {t('tooloptions.picker.set_fg')}
                        </button>
                        <button
                            className={`pref-btn ${effectiveTarget === 'bg' ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                            style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                            onClick={() => onToolOptionChange('pickerTarget', 'bg')}
                            title={t('tooloptions.picker.set_bg_hint')}
                        >
                            {t('tooloptions.picker.set_bg')}
                        </button>
                    </div>
                </div>
                <div className="tool-options-divider" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: 4 }}>
                    {t('tooloptions.picker.toggle_hint')}
                </span>
            </>
        )
    }

    const handleSaveTextPreset = () => {
        const name = prompt(t('tooloptions.enter_preset_name'), `Text Style ${textStylePresets.length + 1}`)
        if (name) {
            addTextStylePreset({
                name,
                fontFamily: toolOptions.fontFamily,
                fontSize: toolOptions.fontSize,
                color: toolOptions.textColor,
                bold: toolOptions.textBold,
                italic: toolOptions.textItalic,
                underline: toolOptions.textUnderline,
                strikethrough: toolOptions.textStrikethrough
            })
        }
    }

    const renderTextOptions = () => (
        <>
            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                    className="tool-options-select"
                    style={{ maxWidth: 100, height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    onChange={(e) => {
                        const preset = textStylePresets.find(p => p.id === e.target.value)
                        if (preset) {
                            onToolOptionChange('fontFamily', preset.fontFamily)
                            onToolOptionChange('fontSize', preset.fontSize)
                            onToolOptionChange('textColor', preset.color)
                            onToolOptionChange('textBold', preset.bold)
                            onToolOptionChange('textItalic', preset.italic)
                            onToolOptionChange('textUnderline', preset.underline)
                            onToolOptionChange('textStrikethrough', preset.strikethrough)
                        }
                        e.target.value = ''
                    }}
                    value=""
                >
                    <option value="" disabled>{t('tooloptions.presets')}</option>
                    {textStylePresets.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <button
                    className="pref-btn pref-btn-secondary"
                    style={{ height: 24, fontSize: 12, padding: '0 6px' }}
                    onClick={handleSaveTextPreset}
                    title={t('tooloptions.text.save_hint')}
                >
                    +
                </button>
            </div>
            <div className="tool-options-divider" />
            {renderSlider('fontSize', t('tooloptions.size'), 8, 200, 1, 'px')}
            <div className="tool-options-divider" />
            <div className="tool-options-slider-group">
                <span className="slider-label">{t('tooloptions.text.color')}</span>
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
                    title={t('tooloptions.text.use_fg_hint')}
                >
                    FG
                </button>
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-slider-group">
                <span className="slider-label">{t('tooloptions.text.font')}</span>
                <FontSelector
                    value={toolOptions.fontFamily}
                    onChange={(font) => onToolOptionChange('fontFamily', font)}
                />
            </div>
            <div className="tool-options-divider" />

            {/* Alignment */}
            <div className="tool-options-group" style={{ display: 'flex', gap: 2 }}>
                {[
                    { value: 'left', icon: AlignLeft, label: t('tooloptions.text.align.left') },
                    { value: 'center', icon: AlignCenter, label: t('tooloptions.text.align.center') },
                    { value: 'right', icon: AlignRight, label: t('tooloptions.text.align.right') },
                    { value: 'justify', icon: AlignJustify, label: t('tooloptions.text.align.justify') }
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
                    title={t('tooloptions.text.bold')}
                >
                    <Bold size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textItalic ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textItalic', !toolOptions.textItalic)}
                    title={t('tooloptions.text.italic')}
                >
                    <Italic size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textUnderline ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textUnderline', !toolOptions.textUnderline)}
                    title={t('tooloptions.text.underline')}
                >
                    <Underline size={14} />
                </button>
                <button
                    className={`pref-btn ${toolOptions.textStrikethrough ? 'pref-btn-primary' : 'pref-btn-secondary'}`}
                    style={{ width: 28, minWidth: 28, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onToolOptionChange('textStrikethrough', !toolOptions.textStrikethrough)}
                    title={t('tooloptions.text.strikethrough')}
                >
                    <Strikethrough size={14} />
                </button>
            </div>

            <div className="tool-options-divider" />

            {renderSlider('textLetterSpacing', t('tooloptions.text.spacing'), -10, 50, 1, 'px')}

            <div className="tool-options-divider" />

            {renderSlider('textLineHeight', t('tooloptions.text.line_height'), 0.5, 3, 0.1, '×')}
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
                        title={t('tooloptions.zoom.in_hint')}
                    >
                        <ZoomIn size={14} />
                        <span>{t('tooloptions.zoom.in')}</span>
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
                        title={t('tooloptions.zoom.out_hint')}
                    >
                        <ZoomOut size={14} />
                        <span>{t('tooloptions.zoom.out')}</span>
                    </button>
                </div>
                <div className="tool-options-divider" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: 4 }}>
                    {t('tooloptions.picker.toggle_hint')}
                </span>
            </>
        )
    }

    const handleSelectionFromPath = () => {
        if (!activePath) return
        const selection = pathToSelectionPolygon(activePath, 1, true)
        if (!selection) return

        setSelection({
            type: 'path',
            path: selection.points,
            x: selection.bounds.minX,
            y: selection.bounds.minY,
            width: selection.bounds.maxX - selection.bounds.minX,
            height: selection.bounds.maxY - selection.bounds.minY
        })
    }

    const handleFillPath = () => {
        if (!activePath) return
        const canvas = createFilledPathCanvas({
            path: activePath,
            canvasWidth: canvasSize.width,
            canvasHeight: canvasSize.height,
            color: foregroundColor
        })
        if (!canvas) return
        const count = layers.filter((layer) => layer.name.startsWith(t('tooloptions.path.fill_name'))).length + 1
        addLayer(`${t('tooloptions.path.fill_name')} ${count}`, canvas)
    }

    const handleStrokePath = () => {
        if (!activePath) return
        const canvas = createStrokedPathCanvas({
            path: activePath,
            canvasWidth: canvasSize.width,
            canvasHeight: canvasSize.height,
            color: foregroundColor,
            lineWidth: toolOptions.brushSize
        })
        if (!canvas) return
        const count = layers.filter((layer) => layer.name.startsWith(t('tooloptions.path.stroke_name'))).length + 1
        addLayer(`${t('tooloptions.path.stroke_name')} ${count}`, canvas)
    }

    const canSelectFromPath = !!activePath && activePath.nodes.length >= 2
    const canFillPath = !!activePath && activePath.closed && activePath.nodes.length >= 3
    const canStrokePath = !!activePath && activePath.nodes.length >= 2
    const canDeleteActivePath = !!activePathId

    const renderPathOptions = () => (
        <>
            <div className="tool-options-group">
                <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 2, borderRadius: 6, gap: 2 }}>
                    {[
                        { mode: 'design', icon: PenTool, label: t('tooloptions.path.mode.design'), hint: t('tooloptions.path.mode.design_hint') },
                        { mode: 'edit', icon: MousePointer2, label: t('tooloptions.path.mode.edit'), hint: t('tooloptions.path.mode.edit_hint') },
                        { mode: 'move', icon: MoveIcon, label: t('tooloptions.path.mode.move'), hint: t('tooloptions.path.mode.move_hint') }
                    ].map(({ mode, icon: Icon, label, hint }) => (
                        <button
                            key={mode}
                            onClick={() => onToolOptionChange('pathMode', mode as any)}
                            title={hint}
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
                    title={t('tooloptions.path.polygonal_hint')}
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
                    <span>{t('tooloptions.path.polygonal')}</span>
                </button>
            </div>

            <div className="tool-options-divider" />

            <div className="tool-options-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 4, padding: 2, gap: 1 }}>
                    <button
                        onClick={handleSelectionFromPath}
                        title={canSelectFromPath ? t('tooloptions.path.selection_hint') : t('tooloptions.path.selection_error')}
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: canSelectFromPath ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: canSelectFromPath ? 'pointer' : 'default', opacity: canSelectFromPath ? 1 : 0.5 }}
                        disabled={!canSelectFromPath}
                    >
                        <BoxSelect size={15} />
                    </button>
                    <button
                        onClick={handleFillPath}
                        title={canFillPath ? t('tooloptions.path.fill_hint') : t('tooloptions.path.fill_error')}
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: canFillPath ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: canFillPath ? 'pointer' : 'default', opacity: canFillPath ? 1 : 0.5 }}
                        disabled={!canFillPath}
                    >
                        <PaintBucket size={15} />
                    </button>
                    <button
                        onClick={handleStrokePath}
                        title={canStrokePath ? t('tooloptions.path.stroke_hint') : t('tooloptions.path.stroke_error')}
                        style={{ height: 24, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, border: 'none', background: 'transparent', color: canStrokePath ? 'var(--text-primary)' : 'var(--text-disabled)', cursor: canStrokePath ? 'pointer' : 'default', opacity: canStrokePath ? 1 : 0.5 }}
                        disabled={!canStrokePath}
                    >
                        <PenLine size={15} />
                    </button>
                </div>

                <div style={{ width: 1, height: 16, background: 'var(--border-main)' }} />

                <button
                    onClick={() => activePathId && deletePath(activePathId)}
                    title={canDeleteActivePath ? t('tooloptions.path.delete_hint') : t('layers.paths.no_active')}
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
                        opacity: canDeleteActivePath ? 1 : 0.5
                    }}
                    disabled={!canDeleteActivePath}
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </>
    )



    /**
     * Determine the nearest supported API image size based on the target region
     * dimensions. Supported sizes: 1024x1024, 1344x768, 768x1344.
     */
    const pickApiSize = (w: number, h: number): string => {
        if (w === 0 || h === 0) return '1024x1024'
        const ratio = w / h
        // Landscape threshold: wider than 1.2:1
        if (ratio > 1.2) return '1344x768'
        // Portrait threshold: taller than 1.2:1
        if (ratio < 1 / 1.2) return '768x1344'
        return '1024x1024'
    }

    /**
     * Apply a clipping mask matching the current selection shape to a canvas
     * context, so generated content is composited only inside the selection.
     */
    const applySelectionClip = (ctx: CanvasRenderingContext2D) => {
        if (!selection) return
        ctx.beginPath()
        if (selection.type === 'rect') {
            ctx.rect(selection.x, selection.y, selection.width, selection.height)
        } else if (selection.type === 'ellipse') {
            const rx = selection.width / 2
            const ry = selection.height / 2
            const cx = selection.x + rx
            const cy = selection.y + ry
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        } else if (selection.type === 'path' && selection.path && selection.path.length > 2) {
            ctx.moveTo(selection.path[0].x, selection.path[0].y)
            for (let i = 1; i < selection.path.length; i++) {
                ctx.lineTo(selection.path[i].x, selection.path[i].y)
            }
            ctx.closePath()
        } else {
            // Fallback: no clip needed
            return
        }
        ctx.clip()
    }

    // Error message state for gen-fill
    const [genFillError, setGenFillError] = useState<string | null>(null)

    /**
     * Core generative fill handler.
     * Fixes:
     *  - Uses selection bounds / canvas size to pick the correct API size
     *  - Composites the generated image correctly into a canvas-sized layer
     *  - Applies selection clip for rect, ellipse, and path selections
     *  - Shows visible error feedback on failure
     */
    const handleGenFill = async () => {
        if (!genPrompt.trim()) {
            setGenFillError(t('tooloptions.gen_fill.error_no_prompt'))
            return
        }

        setIsGenerating(true)
        setGenFillError(null)

        try {
            // Determine the target region: use selection bounds if present, else full canvas
            const targetW = selection ? selection.width : canvasSize.width
            const targetH = selection ? selection.height : canvasSize.height
            const apiSize = pickApiSize(targetW, targetH)

            const url = await AIService.generateImage(genPrompt, apiSize)

            // Load the generated image
            const img = new window.Image()
            img.crossOrigin = 'Anonymous'
            img.src = url
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = () => reject(new Error('Failed to load generated image'))
            })

            // Create a canvas the same size as the document canvas
            const outputCanvas = document.createElement('canvas')
            outputCanvas.width = canvasSize.width
            outputCanvas.height = canvasSize.height
            const ctx = outputCanvas.getContext('2d')
            if (!ctx) throw new Error('Could not get canvas context')

            if (selection && (selection.width > 0 || selection.height > 0)) {
                // Composite the generated image scaled to fit the selection bounds,
                // clipped to the exact selection shape (rect / ellipse / path).
                ctx.save()
                applySelectionClip(ctx)
                ctx.drawImage(
                    img,
                    selection.x,
                    selection.y,
                    selection.width,
                    selection.height
                )
                ctx.restore()
            } else {
                // No active selection — place the image centred on the canvas,
                // scaled to fit while preserving aspect ratio.
                const scale = Math.min(
                    canvasSize.width / img.width,
                    canvasSize.height / img.height
                )
                const dw = img.width * scale
                const dh = img.height * scale
                const dx = (canvasSize.width - dw) / 2
                const dy = (canvasSize.height - dh) / 2
                ctx.drawImage(img, dx, dy, dw, dh)
            }

            // Add as a new layer, named after the prompt (truncated)
            const layerName = `AI: ${genPrompt.substring(0, 40)}`
            addLayer(layerName, outputCanvas)
        } catch (e: any) {
            console.error('[GenFill] Generation failed:', e)
            setGenFillError(e?.message || t('tooloptions.gen_fill.error_failed'))
        } finally {
            setIsGenerating(false)
        }
    }

    const renderGenFillOptions = () => {
        // Determine the effective generation size label for user feedback
        const targetW = selection ? selection.width : canvasSize.width
        const targetH = selection ? selection.height : canvasSize.height
        const apiSize = pickApiSize(targetW, targetH)
        const hasSelection = !!(selection && (selection.width > 0 || selection.height > 0))

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                {/* Prompt input with sparkle icon */}
                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 420 }}>
                    <Sparkles
                        size={14}
                        style={{
                            position: 'absolute',
                            left: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)',
                            pointerEvents: 'none'
                        }}
                    />
                    <input
                        type="text"
                        className="tool-options-text-input"
                        placeholder={t('tooloptions.gen_fill.prompt_placeholder')}
                        value={genPrompt}
                        onChange={(e) => { setGenPrompt(e.target.value); setGenFillError(null) }}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleGenFill() }}
                        style={{ width: '100%', paddingLeft: 28 }}
                        disabled={isGenerating}
                    />
                </div>

                {/* Size hint badge — shows which API size will be used */}
                <span
                    title={t('tooloptions.gen_fill.size_hint')}
                    style={{
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-main)',
                        borderRadius: 3,
                        padding: '2px 5px',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace'
                    }}
                >
                    {apiSize}
                </span>

                {/* Selection indicator */}
                {hasSelection && (
                    <span style={{ fontSize: 10, color: 'var(--accent-active)', whiteSpace: 'nowrap' }}>
                        ✦ {selection!.type}
                    </span>
                )}

                {/* Generate button */}
                <button
                    className="pref-btn pref-btn-primary"
                    onClick={handleGenFill}
                    disabled={isGenerating || !genPrompt.trim()}
                    style={{
                        height: 24,
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        opacity: (isGenerating || !genPrompt.trim()) ? 0.6 : 1
                    }}
                >
                    {isGenerating
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Sparkles size={14} />
                    }
                    <span>{isGenerating
                        ? t('tooloptions.gen_fill.generating')
                        : t('tooloptions.gen_fill.generate')
                    }</span>
                </button>

                {/* Inline error message */}
                {genFillError && (
                    <span style={{
                        fontSize: 11,
                        color: '#ff5555',
                        background: 'rgba(255,85,85,0.1)',
                        border: '1px solid rgba(255,85,85,0.3)',
                        borderRadius: 3,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap'
                    }}>
                        ⚠ {genFillError}
                    </span>
                )}
            </div>
        )
    }

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
            case 'gradient':
                return renderGradientOptions()
            case 'text':
                return renderTextOptions()
            case 'picker':
                return renderPickerOptions()
            case 'clone':
                return renderCloneOptions()
            case 'crop':
                return renderCropOptions()
            case 'zoom':
                return renderZoomOptions()
            case 'paths':
                return renderPathOptions()
            case 'gen-fill':
                return renderGenFillOptions()
            case 'lasso-select':
            case 'rect-select':
            case 'ellipse-select':
                return (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {t('tooloptions.selection_tools')}
                    </span>
                )
            default:
                return (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {t('tooloptions.no_options')}
                    </span>
                )
        }
    }

    return (
        <div className="tool-options">
            <span className="tool-options-label" style={{ fontWeight: 600, color: 'var(--text-tertiary)', marginRight: 12 }}>{label}</span>
            {renderToolSpecificOptions()}
        </div>
    )
}
