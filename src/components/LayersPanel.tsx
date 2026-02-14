import {
    MoreVertical,
    ChevronDown,
    Paintbrush,
    Move,
    Grid3X3,
    Lock,
    Link,
    Unlink,
    Eye,
    EyeOff,
    FolderOpen,
    ChevronRight,
    Search,
    Filter,
    Plus,
    Copy,
    FolderPlus,
    Trash2,
    ArrowUp,
    ArrowDown,
    CircleDot,
    Anchor,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useEditor, Layer } from './EditorContext'

function LayerThumbnail({ layer }: { layer: Layer }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set thumbnail resolution
        canvas.width = 64
        canvas.height = 64

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (layer.data) {
            // Draw image "contain" style
            const hRatio = canvas.width / layer.data.width
            const vRatio = canvas.height / layer.data.height
            const ratio = Math.min(hRatio, vRatio)

            const w = layer.data.width * ratio
            const h = layer.data.height * ratio
            const x = (canvas.width - w) / 2
            const y = (canvas.height - h) / 2

            ctx.drawImage(
                layer.data,
                0,
                0,
                layer.data.width,
                layer.data.height,
                x,
                y,
                w,
                h
            )
        }
    }, [layer.data])

    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

export default function LayersPanel() {
    const {
        layers,
        activeLayerId,
        setActiveLayer,
        toggleLayerVisibility,
        toggleLayerLock,
        setLayerOpacity,
        addLayer,
        deleteLayer,
        reorderLayers
    } = useEditor()

    // Determine active layer object for lock/opacity controls
    const activeLayer = layers.find(l => l.id === activeLayerId)

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeLayerId) {
            setLayerOpacity(activeLayerId, Number(e.target.value))
        }
    }

    return (
        <div className="dialogue" style={{ flex: 1, overflow: 'hidden' }}>
            {/* Header tabs */}
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <div className="dialogue-tab active">Layers</div>
                    <div className="dialogue-tab inactive">Channels</div>
                    <div className="dialogue-tab inactive">Paths</div>
                    <div className="dialogue-tab inactive">Undo</div>
                </div>
                <div className="dialogue-more">
                    <MoreVertical size={16} />
                </div>
            </div>

            {/* Blend mode row */}
            <div className="layers-blend-row">
                <span className="dialogue-bar-label">Mode</span>
                <div className="layers-dropdown" style={{ width: 161 }}>
                    <span>{activeLayer?.blendMode || 'Normal'}</span>
                    <ChevronDown size={16} />
                </div>
                <div className="layers-legacy">
                    <span className="layers-legacy-label">Legacy Mode</span>
                    <div className="toggle off" />
                </div>
            </div>

            <div className="dialogue-divider" />

            {/* Lock and opacity row */}
            <div className="layers-lock-row">
                <span className="layers-lock-label">Lock</span>
                <div className="layers-lock-icon"><Paintbrush size={16} /></div>
                <div className="layers-lock-icon"><Move size={16} /></div>
                <div className="layers-lock-icon"><Grid3X3 size={12} /></div>
                <div
                    className={`layers-lock-icon${activeLayer?.locked ? ' active' : ''}`}
                    onClick={() => activeLayerId && toggleLayerLock(activeLayerId)}
                >
                    <Lock size={16} />
                </div>
                <span className="layers-opacity-label">Opacity</span>
                <input
                    type="range"
                    className="layers-opacity-slider"
                    min={0}
                    max={100}
                    value={activeLayer?.opacity ?? 100}
                    onChange={handleOpacityChange}
                    disabled={!activeLayerId}
                />
                <div className="layers-opacity-dropdown">
                    <span>{activeLayer?.opacity ?? 100}%</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            <div className="dialogue-divider" />

            {/* Layer list */}
            <div className="layer-list" style={{ flex: 1, overflowY: 'auto' }}>
                {layers.length === 0 && (
                    <div style={{ padding: 10, color: '#888', textAlign: 'center' }}>
                        No layers
                    </div>
                )}
                {layers.map((layer, i) => (
                    <div
                        key={layer.id}
                        className={`layer-row${layer.id === activeLayerId ? ' selected' : ''}`}
                        onClick={() => setActiveLayer(layer.id)}
                    >
                        <div className="layer-info">
                            {/* Indent placeholder if needed */}
                            {/* Group logic can be added here later */}

                            {layer.type === 'group' ? (
                                <div className="layer-folder-icon">
                                    <FolderOpen size={16} />
                                </div>
                            ) : (
                                <div className="layer-thumb">
                                    <LayerThumbnail layer={layer} />
                                </div>
                            )}
                            <span className={`layer-name${!layer.visible ? ' muted' : ''}`}>
                                {layer.name}
                            </span>
                        </div>
                        <div className="layer-status">
                            {layer.locked && (
                                <div className="layer-status-icon">
                                    <Lock size={16} />
                                </div>
                            )}

                            <div
                                className={`layer-status-icon${!layer.visible ? ' off' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleLayerVisibility(layer.id)
                                }}
                            >
                                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty rows to fill space */}
                {/* {[0, 1].map((i) => (
                    <div key={`empty-${i}`} className="layer-row" style={{ height: 32 }} />
                ))} */}
            </div>

            <div className="dialogue-divider" />

            {/* Layer search */}
            <div className="layer-search">
                <div className="layer-search-input">
                    <input type="text" placeholder="Layer Search" readOnly />
                    <Search size={16} />
                </div>
                <div className="dialogue-view-toggle">
                    <Filter size={16} />
                </div>
            </div>

            <div className="dialogue-divider" />

            {/* Actions bar */}
            <div className="dialogue-actions">
                <div className="dialogue-actions-left">
                    <div
                        className="dialogue-action-btn"
                        title="New Layer"
                        onClick={() => addLayer('New Layer')}
                    >
                        <Plus size={16} />
                    </div>
                    <div className="dialogue-action-btn" title="Duplicate Layer"><Copy size={16} /></div>
                    <div className="dialogue-action-btn" title="New Group"><FolderPlus size={16} /></div>
                    <div
                        className={`dialogue-action-btn${!activeLayerId ? ' disabled' : ''}`}
                        title="Delete Layer"
                        onClick={() => activeLayerId && deleteLayer(activeLayerId)}
                    >
                        <Trash2 size={16} />
                    </div>
                </div>
                <div className="dialogue-actions-center" style={{ marginLeft: 20 }}>
                    <div className="dialogue-action-btn"><ArrowUp size={16} /></div>
                    <div className="dialogue-action-btn"><ArrowDown size={16} /></div>
                </div>
                <div className="dialogue-actions-right">
                    <div className="dialogue-action-btn"><CircleDot size={16} /></div>
                    <div className="dialogue-action-btn"><Anchor size={16} /></div>
                </div>
            </div>

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
