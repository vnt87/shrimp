import {
    MousePointer,
    Hand,
    Scissors,
    Crop,
    Search,
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
    // Removed unused imports
    LucideIcon
} from 'lucide-react'

export interface ToolDefinition {
    id: string
    icon: LucideIcon
    label: string
}

export const shortcuts: Record<string, string> = {
    'rect-select': 'R', 'ellipse-select': 'E', 'move': 'V', 'crop': 'C',
    'brush': 'B', 'pencil': 'N', 'eraser': 'Shift+E', 'bucket': 'G',
    'picker': 'I', 'text': 'T', 'zoom': 'Z',
}

// Tool groups with dividers between them
export const toolGroups: ToolDefinition[][] = [
    [
        { id: 'rect-select', icon: MousePointer, label: 'Rect Select' },
        { id: 'ellipse-select', icon: CircleDot, label: 'Ellipse Select' },
        { id: 'lasso-select', icon: Lasso, label: 'Lasso Select' },
        { id: 'wand-select', icon: Wand2, label: 'Magic Wand' },
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
        { id: 'zoom', icon: Search, label: 'Zoom' },
    ],
    [
        { id: 'navigate', icon: Hand, label: 'Navigate' },
    ],
]

export const SELECTION_TOOLS = toolGroups[0]
export const PAINT_TOOLS = [...toolGroups[4], ...toolGroups[5]]
export const TRANSFORM_TOOLS = toolGroups[3]
export const OTHER_TOOLS = [...toolGroups[1], ...toolGroups[2], ...toolGroups[6], ...toolGroups[7], ...toolGroups[8], ...toolGroups[9]]

export const MENU_TOOL_GROUPS = [
    { label: 'Selection Tools', tools: SELECTION_TOOLS },
    { label: 'Paint Tools', tools: PAINT_TOOLS },
    { label: 'Transform Tools', tools: TRANSFORM_TOOLS },
    { label: 'Other Tools', tools: OTHER_TOOLS },
]

export function getToolLabel(toolId: string): string {
    const flatTools = toolGroups.flat()
    const tool = flatTools.find(t => t.id === toolId)
    if (!tool) return ''

    const label = tool.label
    const shortcut = shortcuts[toolId]
    return shortcut ? `${label} (${shortcut})` : label
}
