import {
    BoxSelect,
    Crop,
    ZoomIn,
    Move,
    Type,
    Brush,
    Eraser,
    PaintBucket,
    Blend,
    PenTool,
    Pencil,
    Pipette,
    Wand2,
    LassoSelect,
    CircleDashed,
    Scale3d,
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
    'picker': 'I', 'text': 'T', 'zoom': 'Z', 'paths': 'P',
}

// Tool groups with dividers between them
export const toolGroups: ToolDefinition[][] = [
    [
        { id: 'rect-select', icon: BoxSelect, label: 'Rect Select' },
        { id: 'ellipse-select', icon: CircleDashed, label: 'Ellipse Select' },
        { id: 'lasso-select', icon: LassoSelect, label: 'Lasso Select' },
        { id: 'wand-select', icon: Wand2, label: 'Magic Wand' },
    ],
    [
        { id: 'paths', icon: PenTool, label: 'Paths' },
    ],
    [
        { id: 'picker', icon: Pipette, label: 'Color Picker' },
    ],
    [
        { id: 'move', icon: Move, label: 'Move' },
        { id: 'crop', icon: Crop, label: 'Crop' },
    ],
    [
        { id: 'brush', icon: Brush, label: 'Brush' },
        { id: 'pencil', icon: Pencil, label: 'Pencil' },
    ],
    [
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'bucket', icon: PaintBucket, label: 'Bucket Fill' },
        { id: 'gradient', icon: Blend, label: 'Gradient' },
    ],
    [
        { id: 'text', icon: Type, label: 'Text' },
    ],
    [
        { id: 'transform', icon: Scale3d, label: 'Transform' },
    ],
    [
        { id: 'zoom', icon: ZoomIn, label: 'Zoom' },
    ],
]

export const SELECTION_TOOLS = toolGroups[0]
export const PAINT_TOOLS = [...toolGroups[4], ...toolGroups[5]]
export const TRANSFORM_TOOLS = toolGroups[3]
export const OTHER_TOOLS = [...toolGroups[1], ...toolGroups[2], ...toolGroups[6], ...toolGroups[7], ...toolGroups[8]]

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
