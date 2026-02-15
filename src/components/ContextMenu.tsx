import { useEffect, useRef, useState } from 'react'
import { MENU_TOOL_GROUPS, type ToolDefinition } from '../data/tools'
import { ChevronRight } from 'lucide-react'

interface ContextMenuProps {
    x: number
    y: number
    onClose: () => void
    onSelect: (toolId: string) => void
}

export default function ContextMenu({ x, y, onClose, onSelect }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

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
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 1000,
        backgroundColor: '#2b2b2b',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        padding: '4px 0',
        minWidth: '180px'
    }

    return (
        <div ref={menuRef} style={style} className="context-menu" onContextMenu={(e) => e.preventDefault()}>
            {MENU_TOOL_GROUPS.map((group, idx) => (
                <ContextSubMenu key={idx} label={group.label} tools={group.tools} onSelect={onSelect} onClose={onClose} />
            ))}
        </div>
    )
}

function ContextSubMenu({ label, tools, onSelect, onClose }: { label: string, tools: ToolDefinition[], onSelect: (id: string) => void, onClose: () => void }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div
            className="context-menu-item"
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
                position: 'relative'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                setIsOpen(true)
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                setIsOpen(false)
            }}
        >
            <span>{label}</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto' }} />

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: '100%',
                        backgroundColor: '#2b2b2b',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                        padding: '4px 0',
                        minWidth: '160px',
                        zIndex: 1001,
                        marginLeft: '-2px'
                    }}
                >
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
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    color: 'var(--text-primary)',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <Icon size={14} />
                                <span>{tool.label}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
