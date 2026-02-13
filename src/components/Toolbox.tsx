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
const toolGroups = [
    [
        { icon: MousePointer, label: 'Rectangle Select' },
        { icon: Lasso, label: 'Free Select' },
        { icon: Wand2, label: 'Fuzzy Select', active: true },
    ],
    [
        { icon: Scissors, label: 'Scissors' },
        { icon: Pen, label: 'Paths' },
    ],
    [
        { icon: Pipette, label: 'Color Picker' },
        { icon: Ruler, label: 'Measure' },
    ],
    [
        { icon: Move, label: 'Move' },
        { icon: Compass, label: 'Align' },
        { icon: Crop, label: 'Crop' },
        { icon: Stamp, label: 'Clone' },
        { icon: Bandage, label: 'Heal' },
    ],
    [
        { icon: Paintbrush, label: 'Paintbrush' },
        { icon: Pencil, label: 'Pencil' },
        { icon: Blend, label: 'Blur/Sharpen' },
    ],
    [
        { icon: Eraser, label: 'Eraser' },
        { icon: PaintBucket, label: 'Bucket Fill' },
        { icon: CircleDot, label: 'Gradient' },
    ],
    [
        { icon: Type, label: 'Text' },
    ],
    [
        { icon: SquareDashedBottom, label: 'Transform' },
    ],
    [
        { icon: Maximize2, label: 'Zoom' },
    ],
    [
        { icon: Hand, label: 'Navigate' },
    ],
]

export default function Toolbox() {
    return (
        <div className="toolbox">
            <div className="toolbox-handle" />

            {toolGroups.map((group, gi) => (
                <div key={gi}>
                    {group.map((tool, ti) => {
                        const Icon = tool.icon
                        return (
                            <div
                                key={ti}
                                className={`toolbox-item${tool.active ? ' active' : ''}`}
                                title={tool.label}
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
