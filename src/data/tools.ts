import {
    BoxSelect,
    Crop,
    ZoomIn,
    Move,
    Type,
    Brush,
    Eraser,
    PaintBucket,
    Contrast,
    PenTool,
    Pencil,
    Pipette,
    Wand2,
    LassoSelect,
    CircleDashed,
    Scale3d,
    Stamp,
    Bandage,
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
    'gradient': 'Shift+G',
    'picker': 'I', 'text': 'T', 'zoom': 'Z', 'paths': 'P', 'clone': 'S', 'heal': 'H',
}

// Tool groups with dividers between them
export const toolGroups: ToolDefinition[][] = [
    [
        { id: 'rect-select', icon: BoxSelect, label: 'tool.rect_select' },
        { id: 'ellipse-select', icon: CircleDashed, label: 'tool.ellipse_select' },
        { id: 'lasso-select', icon: LassoSelect, label: 'tool.lasso_select' },
        { id: 'wand-select', icon: Wand2, label: 'tool.wand_select' },
    ],
    [
        { id: 'paths', icon: PenTool, label: 'tool.paths' },
    ],
    [
        { id: 'picker', icon: Pipette, label: 'tool.picker' },
        { id: 'clone', icon: Stamp, label: 'tool.clone' },
        { id: 'heal', icon: Bandage, label: 'tool.heal' },
    ],
    [
        { id: 'move', icon: Move, label: 'tool.move' },
        { id: 'crop', icon: Crop, label: 'tool.crop' },
    ],
    [
        { id: 'brush', icon: Brush, label: 'tool.brush' },
        { id: 'pencil', icon: Pencil, label: 'tool.pencil' },
    ],
    [
        { id: 'eraser', icon: Eraser, label: 'tool.eraser' },
        { id: 'bucket', icon: PaintBucket, label: 'tool.bucket' },
        { id: 'gradient', icon: Contrast, label: 'tool.gradient' },
    ],
    [
        { id: 'text', icon: Type, label: 'tool.text' },
    ],
    [
        { id: 'transform', icon: Scale3d, label: 'tool.transform' },
    ],
    [
        { id: 'zoom', icon: ZoomIn, label: 'tool.zoom' },
    ],
]

export const SELECTION_TOOLS = toolGroups[0]
export const PAINT_TOOLS = [...toolGroups[4], ...toolGroups[5]]
export const TRANSFORM_TOOLS = toolGroups[3]
export const OTHER_TOOLS = [...toolGroups[1], ...toolGroups[2], ...toolGroups[6], ...toolGroups[7], ...toolGroups[8]]

export const MENU_TOOL_GROUPS = [
    { label: 'toolgroup.selection', tools: SELECTION_TOOLS },
    { label: 'toolgroup.paint', tools: PAINT_TOOLS },
    { label: 'toolgroup.transform', tools: TRANSFORM_TOOLS },
    { label: 'toolgroup.other', tools: OTHER_TOOLS },
]

export function getToolLabel(toolId: string): string {
    const flatTools = toolGroups.flat()
    const tool = flatTools.find(t => t.id === toolId)
    if (!tool) return ''

    const label = tool.label
    const shortcut = shortcuts[toolId]
    return shortcut ? `${label} (${shortcut})` : label
}
