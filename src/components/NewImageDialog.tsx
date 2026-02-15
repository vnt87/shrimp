import React, { useState } from 'react'
import { useEditor } from './EditorContext'

interface NewImageDialogProps {
    open: boolean
    onClose: () => void
}

const PRESETS = [
    {
        label: 'Desktop', items: [
            { name: 'HD (720p)', w: 1280, h: 720 },
            { name: 'Full HD (1080p)', w: 1920, h: 1080 },
            { name: 'QHD (1440p)', w: 2560, h: 1440 },
            { name: '4K UHD', w: 3840, h: 2160 },
            { name: 'MacBook Air 13″', w: 2560, h: 1664 },
            { name: 'MacBook Pro 16″', w: 3456, h: 2234 },
        ]
    },
    {
        label: 'Mobile', items: [
            { name: 'iPhone 15 / 16', w: 1179, h: 2556 },
            { name: 'iPhone 15 Pro Max', w: 1290, h: 2796 },
            { name: 'iPhone SE', w: 750, h: 1334 },
            { name: 'Android (common)', w: 1080, h: 2400 },
            { name: 'iPad Pro 11″', w: 2388, h: 1668 },
            { name: 'iPad Pro 12.9″', w: 2732, h: 2048 },
        ]
    },
    {
        label: 'Common', items: [
            { name: 'Square (1:1)', w: 1080, h: 1080 },
            { name: 'Social Post', w: 1200, h: 630 },
            { name: 'Instagram Story', w: 1080, h: 1920 },
            { name: 'A4 (300 DPI)', w: 2480, h: 3508 },
            { name: 'US Letter (300 DPI)', w: 2550, h: 3300 },
        ]
    },
]

export default function NewImageDialog({ open, onClose }: NewImageDialogProps) {
    const { newImage } = useEditor()
    const [width, setWidth] = useState(1920)
    const [height, setHeight] = useState(1080)
    const [bgType, setBgType] = useState<'white' | 'transparent' | 'custom'>('white')
    const [customColor, setCustomColor] = useState('#ffffff')
    const [selectedPreset, setSelectedPreset] = useState<string | null>('Full HD (1080p)')

    if (!open) return null

    const handleCreate = () => {
        const bgColor = bgType === 'white' ? '#ffffff'
            : bgType === 'transparent' ? 'transparent'
                : customColor
        newImage(width, height, bgColor)
        onClose()
    }

    const handlePresetClick = (name: string, w: number, h: number) => {
        setWidth(w)
        setHeight(h)
        setSelectedPreset(name)
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
            <div className="dialog-content" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
                <div className="dialog-header">
                    <span>Create a New Image</span>
                    <button className="dialog-close-btn" onClick={onClose}>×</button>
                </div>
                <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>
                    {/* Preset Dimensions */}
                    <div>
                        <span style={{ display: 'block', fontSize: 11, marginBottom: 8, color: 'var(--text-secondary)' }}>Preset Sizes</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {PRESETS.map(group => (
                                <div key={group.label}>
                                    <span style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4 }}>{group.label}</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {group.items.map(p => (
                                            <button
                                                key={p.name}
                                                onClick={() => handlePresetClick(p.name, p.w, p.h)}
                                                title={`${p.w} × ${p.h}`}
                                                style={{
                                                    padding: '4px 8px', borderRadius: 4, fontSize: 11,
                                                    border: selectedPreset === p.name ? '1px solid var(--accent-active)' : '1px solid var(--border-color)',
                                                    background: selectedPreset === p.name ? 'var(--accent-active)' : 'var(--bg-input)',
                                                    color: selectedPreset === p.name ? '#fff' : 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 120ms ease',
                                                    lineHeight: 1.3,
                                                }}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dimensions */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <label style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>Width (px)</span>
                            <input
                                type="number"
                                value={width}
                                onChange={e => { setWidth(Math.max(1, parseInt(e.target.value) || 1)); setSelectedPreset(null) }}
                                min={1}
                                max={8192}
                                style={{
                                    width: '100%', padding: '6px 8px', borderRadius: 4,
                                    border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                    color: 'var(--text-primary)', fontSize: 13
                                }}
                            />
                        </label>
                        <label style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>Height (px)</span>
                            <input
                                type="number"
                                value={height}
                                onChange={e => { setHeight(Math.max(1, parseInt(e.target.value) || 1)); setSelectedPreset(null) }}
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

                    {/* Background */}
                    <div>
                        <span style={{ display: 'block', fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)' }}>Background</span>
                        <div className="segmented-control">
                            {(['white', 'transparent', 'custom'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setBgType(opt)}
                                    className={`segmented-btn ${bgType === opt ? 'active' : ''}`}
                                    style={{ flex: 1, textTransform: 'capitalize' }}
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
                                style={{ marginTop: 10, cursor: 'pointer', width: '100%', height: 30, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', padding: 2 }}
                            />
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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
                                border: 'none', background: 'var(--accent-active)',
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
