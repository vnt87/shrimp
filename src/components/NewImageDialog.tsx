import React, { useState } from 'react'
import { useEditor } from './EditorContext'

interface NewImageDialogProps {
    open: boolean
    onClose: () => void
}

export default function NewImageDialog({ open, onClose }: NewImageDialogProps) {
    const { newImage } = useEditor()
    const [width, setWidth] = useState(800)
    const [height, setHeight] = useState(600)
    const [bgType, setBgType] = useState<'white' | 'transparent' | 'custom'>('white')
    const [customColor, setCustomColor] = useState('#ffffff')

    if (!open) return null

    const handleCreate = () => {
        const bgColor = bgType === 'white' ? '#ffffff'
            : bgType === 'transparent' ? 'transparent'
                : customColor
        newImage(width, height, bgColor)
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate()
        if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
        }
    }

    return (
        <div className="dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="dialog-content" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
                <div className="dialog-header">
                    <span>Create a New Image</span>
                    <button className="dialog-close-btn" onClick={onClose}>×</button>
                </div>
                <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <label style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>Width (px)</span>
                            <input
                                type="number"
                                value={width}
                                onChange={e => setWidth(Math.max(1, parseInt(e.target.value) || 1))}
                                min={1}
                                max={8192}
                                style={{
                                    width: '100%', padding: '6px 8px', borderRadius: 4,
                                    border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                    color: 'var(--text-primary)', fontSize: 13
                                }}
                                autoFocus
                            />
                        </label>
                        <label style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>Height (px)</span>
                            <input
                                type="number"
                                value={height}
                                onChange={e => setHeight(Math.max(1, parseInt(e.target.value) || 1))}
                                min={1}
                                max={8192}
                                style={{
                                    width: '100%', padding: '6px 8px', borderRadius: 4,
                                    border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                    color: 'var(--text-primary)', fontSize: 13
                                }}
                            />
                        </label>
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)' }}>Background</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['white', 'transparent', 'custom'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setBgType(opt)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 4, fontSize: 12,
                                        border: bgType === opt ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                        background: bgType === opt ? 'var(--bg-active)' : 'var(--bg-input)',
                                        color: 'var(--text-primary)', cursor: 'pointer',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        {bgType === 'custom' && (
                            <input
                                type="color"
                                value={customColor}
                                onChange={e => setCustomColor(e.target.value)}
                                style={{ marginTop: 8, cursor: 'pointer', width: 60, height: 30, border: 'none', background: 'none' }}
                            />
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '6px 16px', borderRadius: 4, fontSize: 12,
                                border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                color: 'var(--text-primary)', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            style={{
                                padding: '6px 16px', borderRadius: 4, fontSize: 12,
                                border: 'none', background: 'var(--accent-color)',
                                color: '#fff', cursor: 'pointer', fontWeight: 600
                            }}
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
