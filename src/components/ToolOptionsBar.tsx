import type { ToolOptions } from '../App'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'

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
}

export default function ToolOptionsBar({ activeTool, toolOptions, onToolOptionChange }: ToolOptionsBarProps) {
    const label = toolLabels[activeTool] || activeTool

    const renderSlider = (
        key: keyof ToolOptions,
        labelText: string,
        min: number,
        max: number,
        step: number = 1,
        unit: string = ''
    ) => (
        <div className="tool-options-slider-group" key={key}>
            <span className="slider-label">{labelText}</span>
            <input
                type="range"
                className="tool-options-slider"
                min={min}
                max={max}
                step={step}
                value={toolOptions[key] as number}
                onChange={(e) => onToolOptionChange(key, Number(e.target.value) as ToolOptions[typeof key])}
            />
            <span className="slider-value" style={{ minWidth: 36, textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>
                {toolOptions[key]}{unit}
            </span>
        </div>
    )

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
            <div className="tool-options-slider-group">
                <span className="slider-label">Opacity</span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={toolOptions.bucketOpacity}
                    onChange={(e) => onToolOptionChange('bucketOpacity', parseInt(e.target.value))}
                    className="tool-options-slider"
                />
                <span className="slider-value">{toolOptions.bucketOpacity}%</span>
            </div>
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
            </div>
            <div className="tool-options-divider" />
            <div className="tool-options-slider-group">
                <span className="slider-label">Font</span>
                <select
                    className="tool-options-select"
                    style={{ height: 24, fontSize: 11, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-main)', borderRadius: 4 }}
                    value={toolOptions.fontFamily}
                    onChange={(e) => onToolOptionChange('fontFamily', e.target.value)}
                >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Palatino">Palatino</option>
                    <option value="Garamond">Garamond</option>
                    <option value="Bookman">Bookman</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Arial Black">Arial Black</option>
                    <option value="Impact">Impact</option>
                </select>
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

            {/* Style */}
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
            </div>

            <div className="tool-options-divider" />

            {renderSlider('textLetterSpacing', 'Spacing', -10, 50, 1, 'px')}
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
            case 'crop':
                return renderCropOptions()
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
