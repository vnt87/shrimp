import type { ToolOptions } from '../App'

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
                return renderBucketOptions()
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
