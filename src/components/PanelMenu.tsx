import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Minimize2, Maximize2, X } from 'lucide-react'
import { useLayout, LayoutState } from './LayoutContext'

interface PanelMenuProps {
    panelId: keyof LayoutState['panels']
}

export default function PanelMenu({ panelId }: PanelMenuProps) {
    const { panels, togglePanelMinimized, togglePanelVisibility } = useLayout()
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef<HTMLDivElement>(null)
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })

    const isMinimized = panels[panelId].minimized

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                // Check if click is inside the portal menu (handle via ID or class if needed, 
                // but since the menu is in a portal, event.target checking ref usually fails if ref is not passed down 
                // or if we depend on containment. Closest check is better.)
                const target = event.target as HTMLElement
                if (!target.closest('.panel-menu-dropdown')) {
                    setIsOpen(false)
                }
            }
        }

        function handleScroll() {
            if (isOpen) setIsOpen(false)
        }

        window.addEventListener('mousedown', handleClickOutside)
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleScroll)

        return () => {
            window.removeEventListener('mousedown', handleClickOutside)
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleScroll)
        }
    }, [isOpen])

    const toggleMenu = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setMenuPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right
            })
        }
        setIsOpen(!isOpen)
    }

    return (
        <>
            <div
                className="dialogue-more"
                ref={buttonRef}
                onClick={toggleMenu}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 3, background: isOpen ? 'var(--bg-active)' : 'transparent' }}
            >
                <MoreVertical size={16} />
            </div>

            {isOpen && createPortal(
                <div
                    className="panel-menu-dropdown"
                    style={{
                        position: 'fixed',
                        top: menuPosition.top,
                        right: menuPosition.right,
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 9999,
                        minWidth: 120,
                        padding: '4px 0',
                    }}
                >
                    <div
                        className="panel-menu-item"
                        onClick={() => {
                            togglePanelMinimized(panelId)
                            setIsOpen(false)
                        }}
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-active)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                        <span>{isMinimized ? 'Expand' : 'Minimize'}</span>
                    </div>
                    <div
                        className="panel-menu-item"
                        onClick={() => {
                            togglePanelVisibility(panelId)
                            setIsOpen(false)
                        }}
                        style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-active)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <X size={14} />
                        <span>Close</span>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
