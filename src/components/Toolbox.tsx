import { useState } from 'react'
import {
    MousePointer,
    Hand,
    Scissors,
    Crop,
    Maximize2,
    Move,
    Type,
    Paintbrush,
    Eraser,
    PaintBucket,
    Stamp,
    Bandage,
    Pen,
    Pencil,
    Pipette,
    Wand2,
    Blend,
    Lasso,
    CircleDot,
    SquareDashedBottom,
    Ruler,
    Compass,
    RotateCcw,
    ArrowUpDown,
} from 'lucide-react'
import { useEditor } from './EditorContext'
import ColorPicker from './ColorPicker'
import Tooltip from './Tooltip'

// Shortcut map
const shortcuts: Record<string, string> = {
    'rect-select': 'R', 'ellipse-select': 'E', 'move': 'V', 'crop': 'C',
    'brush': 'B', 'pencil': 'N', 'eraser': 'Shift+E', 'bucket': 'G',
    'picker': 'O', 'text': 'T', 'zoom': 'Z',
}

// Tool groups with dividers between them
const toolGroups = [
    [
        { id: 'rect-select', icon: MousePointer, label: 'Rectangle Select' },
        { id: 'ellipse-select', icon: Lasso, label: 'Ellipse Select' },
        { id: 'wand-select', icon: Wand2, label: 'Fuzzy Select' },
    ],
    [
        { id: 'scissors', icon: Scissors, label: 'Scissors' },
        { id: 'paths', icon: Pen, label: 'Paths' },
    ],
    [
        { id: 'picker', icon: Pipette, label: 'Color Picker' },
        { id: 'measure', icon: Ruler, label: 'Measure' },
    ],
    [
        { id: 'move', icon: Move, label: 'Move' },
        { id: 'align', icon: Compass, label: 'Align' },
        { id: 'crop', icon: Crop, label: 'Crop' },
        { id: 'clone', icon: Stamp, label: 'Clone' },
        { id: 'heal', icon: Bandage, label: 'Heal' },
    ],
    [
        { id: 'brush', icon: Paintbrush, label: 'Paintbrush' },
        { id: 'pencil', icon: Pencil, label: 'Pencil' },
        { id: 'blur', icon: Blend, label: 'Blur/Sharpen' },
    ],
    [
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'bucket', icon: PaintBucket, label: 'Bucket Fill' },
        { id: 'gradient', icon: CircleDot, label: 'Gradient' },
    ],
    [
        { id: 'text', icon: Type, label: 'Text' },
    ],
    [
        { id: 'transform', icon: SquareDashedBottom, label: 'Transform' },
    ],
    [
        { id: 'zoom', icon: Maximize2, label: 'Zoom' },
    ],
    [
        { id: 'navigate', icon: Hand, label: 'Navigate' },
    ],
]

interface ToolboxProps {
    activeTool?: string
    onToolSelect?: (toolId: string) => void
}

export default function Toolbox({ activeTool = 'move', onToolSelect }: ToolboxProps) {
    const { foregroundColor, backgroundColor, setForegroundColor, setBackgroundColor, swapColors, resetColors } = useEditor()
    const [colorPickerTarget, setColorPickerTarget] = useState<'fg' | 'bg' | null>(null)
    const [hoveredToolId, setHoveredToolId] = useState<string | null>(null)
    const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)

    return (
        <div className="toolbox">
            <div className="toolbox-handle" />

            {toolGroups.map((group, gi) => (
                <div key={gi}>
                    {group.map((tool, ti) => {
                        const Icon = tool.icon
                        const isActive = activeTool === tool.id
                        return (
                            <div
                                key={ti}
                                className={`toolbox-item${isActive ? ' active' : ''}`}
                                onClick={() => onToolSelect?.(tool.id)}
                                onMouseEnter={(e) => {
                                    setHoveredToolId(tool.id)
                                    setHoveredRect(e.currentTarget.getBoundingClientRect())
                                }}
                                onMouseLeave={() => {
                                    setHoveredToolId(null)
                                    setHoveredRect(null)
                                }}
                            >
                                <Icon size={20} />
                            </div>
                        )
                    })}
                    {gi < toolGroups.length - 1 && <div className="toolbox-divider" />}
                </div>
            ))}

            {/* Foreground/Background color swatches */}
            <div className="toolbox-colors" style={{ position: 'relative' }}>
                <div className="toolbox-color-swatches">
                    <div
                        className="toolbox-color-fg"
                        style={{ backgroundColor: foregroundColor, cursor: 'pointer' }}
                        onClick={() => setColorPickerTarget(colorPickerTarget === 'fg' ? null : 'fg')}
                        title="Foreground Color"
                    />
                    <div
                        className="toolbox-color-bg"
                        style={{ backgroundColor: backgroundColor, cursor: 'pointer' }}
                        onClick={() => setColorPickerTarget(colorPickerTarget === 'bg' ? null : 'bg')}
                        title="Background Color"
                    />
                </div>
                <div className="toolbox-color-actions">
                    <span style={{ cursor: 'pointer' }} onClick={resetColors} title="Reset to Default Colors (D)">
                        <RotateCcw size={12} />
                    </span>
                    <span style={{ cursor: 'pointer' }} onClick={swapColors} title="Swap Colors (X)">
                        <ArrowUpDown size={12} />
                    </span>
                </div>

                {/* Color Picker Popover */}
                {colorPickerTarget && (
                    <ColorPicker
                        color={colorPickerTarget === 'fg' ? foregroundColor : backgroundColor}
                        onChange={(c) => colorPickerTarget === 'fg' ? setForegroundColor(c) : setBackgroundColor(c)}
                        onClose={() => setColorPickerTarget(null)}
                        style={{ bottom: '100%', left: 0, marginBottom: 8 }}
                    />
                )}
            </div>

            <Tooltip
                text={hoveredToolId ? `${getToolLabel(hoveredToolId)}` : ''}
                visible={!!hoveredToolId}
                targetRect={hoveredRect}
                offset={10}
            />
        </div>
    )
}

function getToolLabel(toolId: string): string {
    const flatTools = toolGroups.flat()
    const tool = flatTools.find(t => t.id === toolId)
    if (!tool) return ''

    const label = tool.label
    const shortcut = shortcuts[toolId]
    return shortcut ? `${label} (${shortcut})` : label
}
