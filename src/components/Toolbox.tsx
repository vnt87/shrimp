import { useState } from 'react'
import { useEditor } from './EditorContext'
import ColorPickerDialog from './ColorPickerDialog'
import Tooltip from './Tooltip'
import { toolGroups, getToolLabel } from '../data/tools'
import {
    ArrowUpDown,
    RotateCcw,
} from 'lucide-react'

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

                {/* Color Picker Dialog */}
                {colorPickerTarget && (
                    <ColorPickerDialog
                        title={colorPickerTarget === 'fg' ? 'Foreground Color' : 'Background Color'}
                        color={colorPickerTarget === 'fg' ? foregroundColor : backgroundColor}
                        onChange={(c) => colorPickerTarget === 'fg' ? setForegroundColor(c) : setBackgroundColor(c)}
                        onClose={() => setColorPickerTarget(null)}
                    />
                )}
            </div>

            <Tooltip
                text={hoveredToolId ? `${getToolLabel(hoveredToolId)} ` : ''}
                visible={!!hoveredToolId}
                targetRect={hoveredRect}
                offset={10}
            />
        </div >
    )
}

