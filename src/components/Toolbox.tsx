import { useState } from 'react'
import { useEditor } from './EditorContext'
import ColorPickerDialog from './ColorPickerDialog'
import Tooltip from './Tooltip'
import { toolGroups } from '../data/tools'
import { useLanguage } from '../i18n/LanguageContext'
import { TranslationKey } from '../i18n/en'
import {
    ArrowUpDown,
    RotateCcw,
} from 'lucide-react'

interface ToolboxProps {
    activeTool?: string
    onToolSelect?: (toolId: string) => void
}

import { useIntegrationStore } from '../hooks/useIntegrationStore'

export default function Toolbox({ activeTool = 'move', onToolSelect }: ToolboxProps) {
    const { foregroundColor, backgroundColor, setForegroundColor, setBackgroundColor, swapColors, resetColors } = useEditor()
    const { t } = useLanguage()
    const { isAIEnabled } = useIntegrationStore()
    const [colorPickerTarget, setColorPickerTarget] = useState<'fg' | 'bg' | null>(null)
    const [hoveredToolId, setHoveredToolId] = useState<string | null>(null)
    const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null)

    // Filter tools based on enabled features
    const visibleToolGroups = toolGroups.map(group =>
        group.filter(tool => {
            if (tool.id === 'gen-fill') return isAIEnabled;
            return true;
        })
    ).filter(group => group.length > 0);

    const shortcuts: Record<string, string> = {
        'rect-select': 'R', 'ellipse-select': 'E', 'move': 'V', 'crop': 'C',
        'brush': 'B', 'pencil': 'N', 'eraser': 'Shift+E', 'bucket': 'G',
        'gradient': 'Shift+G',
        'picker': 'I', 'text': 'T', 'zoom': 'Z', 'paths': 'P',
    }

    const getToolTipLabel = (toolId: string): string => {
        const flatTools = toolGroups.flat()
        const tool = flatTools.find(t => t.id === toolId)
        if (!tool) return ''

        const label = t(tool.label as TranslationKey)
        const shortcut = shortcuts[toolId]
        return shortcut ? `${label} (${shortcut})` : label
    }

    return (
        <div className="toolbox">
            <div className="toolbox-handle" />

            <div className="toolbox-tools">
                {visibleToolGroups.map((group, gi) => (
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
                        {gi < visibleToolGroups.length - 1 && <div className="toolbox-divider" />}
                    </div>
                ))}
            </div>

            {/* Foreground/Background color swatches */}
            <div className="toolbox-colors" style={{ position: 'relative' }}>
                <div className="toolbox-color-swatches">
                    <div
                        className="toolbox-color-fg"
                        style={{ backgroundColor: foregroundColor, cursor: 'pointer' }}
                        onClick={() => setColorPickerTarget(colorPickerTarget === 'fg' ? null : 'fg')}
                        title={t('toolbox.fg_title')}
                    />
                    <div
                        className="toolbox-color-bg"
                        style={{ backgroundColor: backgroundColor, cursor: 'pointer' }}
                        onClick={() => setColorPickerTarget(colorPickerTarget === 'bg' ? null : 'bg')}
                        title={t('toolbox.bg_title')}
                    />
                </div>
                <div className="toolbox-color-actions">
                    <span style={{ cursor: 'pointer' }} onClick={resetColors} title={t('toolbox.reset_title')}>
                        <RotateCcw size={12} />
                    </span>
                    <span style={{ cursor: 'pointer' }} onClick={swapColors} title={t('toolbox.swap_title')}>
                        <ArrowUpDown size={12} />
                    </span>
                </div>

                {/* Color Picker Dialog */}
                {colorPickerTarget && (
                    <ColorPickerDialog
                        title={colorPickerTarget === 'fg' ? t('toolbox.fg_title') : t('toolbox.bg_title')}
                        color={colorPickerTarget === 'fg' ? foregroundColor : backgroundColor}
                        onChange={(c) => colorPickerTarget === 'fg' ? setForegroundColor(c) : setBackgroundColor(c)}
                        onClose={() => setColorPickerTarget(null)}
                    />
                )}
            </div>

            <Tooltip
                text={hoveredToolId ? `${getToolTipLabel(hoveredToolId)} ` : ''}
                visible={!!hoveredToolId}
                targetRect={hoveredRect}
                offset={10}
            />
        </div >
    )
}

