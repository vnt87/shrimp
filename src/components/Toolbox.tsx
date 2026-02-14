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

// Tool groups with dividers between them
// Each tool now has an id
const toolGroups = [
    [
        { id: 'rect-select', icon: MousePointer, label: 'Rectangle Select' },
        { id: 'lasso-select', icon: Lasso, label: 'Free Select' },
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
                                title={`${tool.label} ${tool.id === 'crop' ? '(C)' : tool.id === 'move' ? '(V)' : ''}`}
                                onClick={() => onToolSelect?.(tool.id)}
                            >
                                <Icon size={20} />
                            </div>
                        )
                    })}
                    {gi < toolGroups.length - 1 && <div className="toolbox-divider" />}
                </div>
            ))}

            {/* Foreground/Background color swatches */}
            <div className="toolbox-colors">
                <div className="toolbox-color-swatches">
                    <div className="toolbox-color-fg" />
                    <div className="toolbox-color-bg" />
                </div>
                <div className="toolbox-color-actions">
                    <RotateCcw size={12} />
                    <ArrowUpDown size={12} />
                </div>
            </div>
        </div>
    )
}
