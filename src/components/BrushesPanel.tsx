import {
    Search,
    List,
    LayoutGrid,
    Plus,
    Edit3,
    Copy,
    Trash2,
    RefreshCw,
    Folder,
} from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import PanelMenu from './PanelMenu'
import { useEditor } from './EditorContext'
import { BrushPreset } from '../types/brush'
import { GradientResource } from '../types/gradient'
import { generateGradientLUT } from '../utils/gradientMath'

const GradientPreview = ({ gradient, onClick, isActive }: { gradient: GradientResource, onClick: () => void, isActive: boolean }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
                const lut = generateGradientLUT(gradient, 128)
                const width = canvasRef.current.width
                const height = canvasRef.current.height

                const imageData = ctx.createImageData(width, height)
                const data = imageData.data

                for (let x = 0; x < width; x++) {
                    const t = x / (width - 1)
                    const lutIndex = Math.floor(t * (lut.length / 4 - 1)) * 4
                    const r = lut[lutIndex]
                    const g = lut[lutIndex + 1]
                    const b = lut[lutIndex + 2]
                    const a = lut[lutIndex + 3]

                    for (let y = 0; y < height; y++) {
                        const i = (y * width + x) * 4
                        data[i] = r
                        data[i + 1] = g
                        data[i + 2] = b
                        data[i + 3] = a
                    }
                }
                ctx.putImageData(imageData, 0, 0)
            }
        }
    }, [gradient])

    return (
        <div
            className={`brush-cell ${isActive ? 'active' : ''}`}
            onClick={onClick}
            title={gradient.name}
            style={{
                cursor: 'pointer',
                aspectRatio: '1',
                border: isActive ? '1px solid #3b82f6' : '1px solid transparent',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div className="brush-cell-inner" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#333' }}>
                <canvas
                    ref={canvasRef}
                    width={64}
                    height={64}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white truncate px-1 opacity-0 hover:opacity-100 transition-opacity">
                {gradient.name}
            </div>
        </div>
    )
}

export default function BrushesPanel() {
    const {
        availableBrushes, activeBrushId, setActiveBrushId, importBrush,
        availableGradients, activeGradient, setActiveGradient, importGradient
    } = useEditor()
    const [activeTab, setActiveTab] = useState<'brushes' | 'gradients' | 'text'>('brushes')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            if (activeTab === 'brushes') {
                importBrush(file, file.name)
            } else if (activeTab === 'gradients') {
                importGradient(file)
            }
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (activeTab === 'brushes') {
                importBrush(file, file.name)
            } else if (activeTab === 'gradients' || file.name.endsWith('.ggr')) {
                // Auto-detect gradient if currently on another tab but dropped a GGR?
                // For now, respect active tab or file extension if unambiguous
                if (file.name.endsWith('.ggr')) {
                    setActiveTab('gradients')
                    importGradient(file)
                } else {
                    importBrush(file, file.name)
                }
            }
        }
    }

    return (
        <div
            className="dialogue"
            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {/* Header tabs */}
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <div
                        className={`dialogue-tab ${activeTab === 'brushes' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('brushes')}
                    >
                        Brushes
                    </div>
                    <div
                        className={`dialogue-tab ${activeTab === 'gradients' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('gradients')}
                    >
                        Gradients
                    </div>
                    <div
                        className={`dialogue-tab ${activeTab === 'text' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('text')}
                    >
                        Text Styles
                    </div>
                </div>
                <PanelMenu panelId="brushes" />
            </div>

            {/* Search bar */}
            <div className="dialogue-bar">
                <div className="dialogue-input" style={{ flex: 1 }}>
                    <input type="text" placeholder={`Filter ${activeTab}...`} readOnly />
                    <Search size={16} />
                </div>
                <div className="dialogue-view-toggle">
                    <List size={16} />
                </div>
                <div className="dialogue-view-toggle">
                    <LayoutGrid size={16} />
                </div>
            </div>

            <div className="dialogue-divider" />

            {/* Content Grid */}
            <div className={`brush-grid-container ${isDragging ? 'bg-blue-900/20' : ''}`} style={{ flex: 1, overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                {((activeTab === 'brushes' && availableBrushes.length === 0) ||
                    (activeTab === 'gradients' && availableGradients.length === 0) ||
                    (activeTab === 'text')) ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', textAlign: 'center', padding: '20px', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                        {activeTab === 'brushes' && "No brushes loaded.\nImport one!"}
                        {activeTab === 'gradients' && "No gradients loaded.\nDrag & drop a .ggr file!"}
                        {activeTab === 'text' && "Text styles coming soon..."}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                        {/* BRUSHES LIST */}
                        {activeTab === 'brushes' && availableBrushes.map((brush: BrushPreset) => (
                            <div
                                key={brush.id}
                                className={`brush-cell ${activeBrushId === brush.id ? 'active' : ''}`}
                                onClick={() => setActiveBrushId(brush.id)}
                                title={brush.name}
                                style={{
                                    cursor: 'pointer',
                                    aspectRatio: '1',
                                    border: activeBrushId === brush.id ? '1px solid #3b82f6' : '1px solid transparent',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}
                            >
                                <div className="brush-cell-inner" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#333' }}>
                                    {brush.thumbnailUrl ? (
                                        <img src={brush.thumbnailUrl} alt={brush.name} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                    ) : (
                                        <div style={{ fontSize: '8px', color: '#aaa', textAlign: 'center', wordBreak: 'break-word' }}>
                                            {brush.name.slice(0, 4)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* GRADIENTS LIST */}
                        {activeTab === 'gradients' && availableGradients.map((grad, i) => (
                            <GradientPreview
                                key={grad.id || i}
                                gradient={grad}
                                isActive={activeGradient?.id === grad.id}
                                onClick={() => setActiveGradient(grad)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="dialogue-divider" />

            {/* Actions */}
            <div className="dialogue-actions">
                <div className="dialogue-actions-left">
                    <div
                        className="dialogue-action-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title={activeTab === 'gradients' ? "Import Gradient (.ggr)" : "Import Brush"}
                        style={{ cursor: 'pointer' }}
                    >
                        <Plus size={16} />
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept={activeTab === 'gradients' ? ".ggr" : activeTab === 'brushes' ? ".gbr,.myb,.kpp" : ""}
                        onChange={handleFileChange}
                    />
                    <div className="dialogue-action-btn"><Edit3 size={16} /></div>
                    <div className="dialogue-action-btn"><Copy size={16} /></div>
                    <div className="dialogue-action-btn"><Trash2 size={16} /></div>
                </div>
                <div className="dialogue-actions-right">
                    <div className="dialogue-action-btn"><RefreshCw size={16} /></div>
                    <div className="dialogue-action-btn"><Folder size={16} /></div>
                </div>
            </div>

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
