import { useEffect, useRef, useState } from 'react'
import { MENU_TOOL_GROUPS, type ToolDefinition } from '../data/tools'
import { ChevronRight } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { TranslationKey } from '../i18n/en'

interface ContextMenuProps {
    x: number
    y: number
    onClose: () => void
    onSelect: (toolId: string) => void
}

export default function ContextMenu({ x, y, onClose, onSelect }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const { t } = useLanguage()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown, { capture: true })
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown, { capture: true })
        }
    }, [onClose])

    // Prevent scrolling from affecting the canvas
    useEffect(() => {
        const menu = menuRef.current
        if (!menu) return

        const handleWheel = (e: WheelEvent) => {
            e.stopPropagation()
        }

        menu.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
            menu.removeEventListener('wheel', handleWheel)
        }
    }, [])

    const style: React.CSSProperties = {
        top: y,
        left: x,
        position: 'fixed'
    }

    return (
        <div ref={menuRef} style={style} className="context-menu" onContextMenu={(e) => e.preventDefault()}>
            {MENU_TOOL_GROUPS.map((group, idx) => (
                <ContextSubMenu key={idx} label={t(group.label as TranslationKey)} tools={group.tools} onSelect={onSelect} onClose={onClose} />
            ))}
        </div>
    )
}

function ContextSubMenu({ label, tools, onSelect, onClose }: { label: string, tools: ToolDefinition[], onSelect: (id: string) => void, onClose: () => void }) {
    const [isOpen, setIsOpen] = useState(false)
    const { t } = useLanguage()

    return (
        <div
            className="context-menu-item"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <span>{label}</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto' }} />

            {isOpen && (
                <div className="context-submenu">
                    {tools.map((tool) => {
                        const Icon = tool.icon
                        return (
                            <div
                                key={tool.id}
                                className="context-menu-subitem"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onSelect(tool.id)
                                    onClose()
                                }}
                            >
                                <Icon size={14} />
                                <span>{t(tool.label as TranslationKey)}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
