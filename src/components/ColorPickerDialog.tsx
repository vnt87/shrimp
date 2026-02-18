import { useState, useRef, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import ColorPicker from './ColorPicker'

interface ColorPickerDialogProps {
    title?: string
    color: string
    onChange: (color: string) => void
    onClose: () => void
}

export default function ColorPickerDialog({
    title = 'Color Picker',
    color,
    onChange,
    onClose
}: ColorPickerDialogProps) {
    const [tempColor, setTempColor] = useState(color)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const dragStart = useRef({ x: 0, y: 0 })

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }))
            dragStart.current = { x: e.clientX, y: e.clientY }
        }

        const handleMouseUp = () => {
            isDragging.current = false
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    const handleSelect = () => {
        onChange(tempColor)
        onClose()
    }

    return (
        <div className="dialog-overlay" style={{ zIndex: 9000 }}>
            <div
                className="filters-dialog"
                style={{
                    /* Wide enough to fit the Photoshop-style picker: SV square (240) + hue strip (20) + inputs (120) + gaps */
                    width: 440,
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    position: 'relative'
                }}
            >
                <div
                    className="dialogue-header"
                    onMouseDown={(e) => {
                        isDragging.current = true
                        dragStart.current = { x: e.clientX, y: e.clientY }
                    }}
                    style={{ cursor: 'move', userSelect: 'none' }}
                >
                    <div className="dialogue-title">
                        {title}
                    </div>
                    <div className="dialogue-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                <div className="dialogue-content" style={{ padding: '12px 15px', background: 'var(--bg-panel)' }}>
                    <ColorPicker
                        color={tempColor}
                        onChange={setTempColor}
                        style={{
                            position: 'relative',
                            zIndex: 'auto',
                            boxShadow: 'none',
                            border: 'none',
                            padding: 0,
                            width: '100%',
                            background: 'transparent'
                        }}
                    />
                </div>

                <div className="dialogue-footer">
                    <button className="pref-btn pref-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="pref-btn pref-btn-primary" onClick={handleSelect}>
                        <Check size={14} style={{ marginRight: 4 }} />
                        Select
                    </button>
                </div>
            </div>
        </div>
    )
}
