import {
    MoreVertical,
    ChevronDown,
    Lock,
    Eye,
    EyeOff,
    FolderOpen,
    Folder,
    Search,
    Plus,
    Copy,
    FolderPlus,
    Trash2,
    Anchor,
    ChevronRight,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useEditor, Layer } from './EditorContext'

// --- Layer Thumbnail ---
function LayerThumbnail({ layer }: { layer: Layer }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 64
        canvas.height = 64
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (layer.data) {
            const hRatio = canvas.width / layer.data.width
            const vRatio = canvas.height / layer.data.height
            const ratio = Math.min(hRatio, vRatio)

            const w = layer.data.width * ratio
            const h = layer.data.height * ratio
            const x = (canvas.width - w) / 2
            const y = (canvas.height - h) / 2

            ctx.drawImage(layer.data, 0, 0, layer.data.width, layer.data.height, x, y, w, h)
        }
    }, [layer.data])

    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

// --- Layer Item Component (Recursive) ---
interface LayerItemProps {
    layer: Layer
    depth: number
    onDragStart: (e: React.DragEvent, layer: Layer) => void
    onDrop: (e: React.DragEvent, targetLayer: Layer, position: 'before' | 'after' | 'inside') => void
}

function LayerItem({ layer, depth, onDragStart, onDrop }: LayerItemProps) {
    const {
        activeLayerId,
        setActiveLayer,
        toggleLayerVisibility,
        selectedLayerIds,
        setSelectedLayerIds,
        toggleGroupExpanded,
        renameLayer
    } = useEditor()

    const [isRenaming, setIsRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState(layer.name)
    const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isRenaming])

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (e.shiftKey && activeLayerId) {
            if (selectedLayerIds.includes(layer.id)) {
                setSelectedLayerIds(selectedLayerIds.filter(id => id !== layer.id))
            } else {
                setSelectedLayerIds([...selectedLayerIds, layer.id])
            }
        } else if (e.metaKey || e.ctrlKey) {
            if (selectedLayerIds.includes(layer.id)) {
                setSelectedLayerIds(selectedLayerIds.filter(id => id !== layer.id))
            } else {
                setSelectedLayerIds([...selectedLayerIds, layer.id])
            }
        } else {
            setActiveLayer(layer.id)
            setSelectedLayerIds([layer.id])
        }
    }

    const handleRenameSubmit = () => {
        if (renameValue.trim()) {
            renameLayer(layer.id, renameValue.trim())
        } else {
            setRenameValue(layer.name)
        }
        setIsRenaming(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.stopPropagation()
        e.preventDefault()

        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const height = rect.height

        let position: 'before' | 'after' | 'inside' = 'inside'

        if (layer.type === 'group') {
            if (y < height * 0.25) position = 'before'
            else if (y > height * 0.75) position = 'after'
            else position = 'inside'
        } else {
            if (y < height * 0.5) position = 'before'
            else position = 'after'
        }

        setDragOverPosition(position)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.stopPropagation()
        setDragOverPosition(null)
    }

    const handleDropInternal = (e: React.DragEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (dragOverPosition) {
            onDrop(e, layer, dragOverPosition)
        }
        setDragOverPosition(null)
    }

    const isSelected = selectedLayerIds.includes(layer.id) || layer.id === activeLayerId

    return (
        <div style={{ paddingLeft: depth * 15 }}>
            <div
                className={`layer-row${isSelected ? ' selected' : ''}`}
                onClick={handleSelect}
                draggable
                onDragStart={(e) => onDragStart(e, layer)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropInternal}
                style={{
                    borderTop: dragOverPosition === 'before' ? '2px solid #00ffff' : undefined,
                    borderBottom: dragOverPosition === 'after' ? '2px solid #00ffff' : undefined,
                    boxShadow: dragOverPosition === 'inside' ? 'inset 0 0 0 2px #00ffff' : undefined
                }}
            >
                <div className="layer-info" style={{ gap: 8 }}>
                    {layer.type === 'group' && (
                        <div
                            className="layer-expand-icon"
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleGroupExpanded?.(layer.id)
                            }}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            {layer.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </div>
                    )}

                    {layer.type === 'group' ? (
                        <div className="layer-folder-icon" onDoubleClick={() => toggleGroupExpanded?.(layer.id)}>
                            {layer.expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                        </div>
                    ) : (
                        <div className="layer-thumb">
                            <LayerThumbnail layer={layer} />
                        </div>
                    )}

                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            className="layer-rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit()
                                if (e.key === 'Escape') {
                                    setRenameValue(layer.name)
                                    setIsRenaming(false)
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className={`layer-name${!layer.visible ? ' muted' : ''}`}
                            onDoubleClick={(e) => {
                                e.stopPropagation()
                                setIsRenaming(true)
                            }}
                        >
                            {layer.name}
                        </span>
                    )}
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

            {layer.type === 'group' && layer.expanded && layer.children && (
                <div className="layer-children">
                    {[...layer.children].map(child => (
                        <LayerItem
                            key={child.id}
                            layer={child}
                            depth={depth + 1}
                            onDragStart={onDragStart}
                            onDrop={onDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// --- Main Panel ---
export default function LayersPanel() {
    const {
        layers,
        activeLayerId,
        toggleLayerLock,
        setLayerOpacity,
        setLayerBlendMode,
        addLayer,
        deleteLayer,
        duplicateLayer,
        createGroup,
        moveLayer,
        selectedLayerIds
    } = useEditor()

    // Determine active layer object for lock/opacity controls
    const findLayer = (list: Layer[], id: string): Layer | null => {
        for (const l of list) {
            if (l.id === id) return l
            if (l.children) {
                const found = findLayer(l.children, id)
                if (found) return found
            }
        }
        return null
    }

    const activeLayer = activeLayerId ? findLayer(layers, activeLayerId) : null

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeLayerId) {
            setLayerOpacity(activeLayerId, Number(e.target.value))
        }
    }

    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, layer: Layer) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ layerId: layer.id }))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDrop = (e: React.DragEvent, targetLayer: Layer, position: 'before' | 'after' | 'inside') => {
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            if (data && data.layerId && data.layerId !== targetLayer.id) {
                moveLayer(data.layerId, targetLayer.id, position)
            }
        } catch (err) {
            console.error('Drop error', err)
        }
    }

    return (
        <div className="dialogue" style={{ flex: 1, overflow: 'hidden' }}>
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

            <div className="layers-blend-row">
                <span className="dialogue-bar-label">Mode</span>
                <select
                    className="layers-dropdown"
                    style={{ width: 161, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 4px', fontSize: 12, cursor: 'pointer' }}
                    value={activeLayer?.blendMode || 'normal'}
                    onChange={(e) => activeLayerId && setLayerBlendMode(activeLayerId, e.target.value)}
                    disabled={!activeLayerId}
                >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="color-dodge">Color Dodge</option>
                    <option value="color-burn">Color Burn</option>
                    <option value="hard-light">Hard Light</option>
                    <option value="soft-light">Soft Light</option>
                    <option value="difference">Difference</option>
                    <option value="exclusion">Exclusion</option>
                    <option value="hue">Hue</option>
                    <option value="saturation">Saturation</option>
                    <option value="color">Color</option>
                    <option value="luminosity">Luminosity</option>
                </select>
            </div>

            <div className="dialogue-divider" />

            <div className="layers-lock-row">
                <span className="layers-lock-label">Lock</span>
                <div
                    className={`layers-lock-icon${activeLayer?.locked ? ' active' : ''}`}
                    onClick={() => activeLayerId && toggleLayerLock(activeLayerId)}
                >
                    <Lock size={16} />
                </div>

                <span className="layers-opacity-label" style={{ marginLeft: 'auto' }}>Opacity</span>
                <input
                    type="range"
                    className="layers-opacity-slider"
                    min={0}
                    max={100}
                    value={activeLayer?.opacity ?? 100}
                    onChange={handleOpacityChange}
                    disabled={!activeLayerId}
                />
            </div>

            <div className="dialogue-divider" />

            <div className="layer-list" style={{ flex: 1, overflowY: 'auto' }}>
                {layers.length === 0 && (
                    <div style={{ padding: 10, color: '#888', textAlign: 'center' }}>
                        No layers
                    </div>
                )}
                {[...layers].map(layer => (
                    <LayerItem
                        key={layer.id}
                        layer={layer}
                        depth={0}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                    />
                ))}
            </div>

            <div className="dialogue-divider" />

            <div className="layer-search">
                <div className="layer-search-input">
                    <input type="text" placeholder="Layer Search" readOnly />
                    <Search size={16} />
                </div>
            </div>

            <div className="dialogue-divider" />

            <div className="dialogue-actions">
                <div className="dialogue-actions-left">
                    <div
                        className="dialogue-action-btn"
                        title="New Layer"
                        onClick={() => addLayer('New Layer')}
                    >
                        <Plus size={16} />
                    </div>
                    <div
                        className={`dialogue-action-btn${!activeLayerId ? ' disabled' : ''}`}
                        title="Duplicate Layer"
                        onClick={() => activeLayerId && duplicateLayer(activeLayerId)}
                    >
                        <Copy size={16} />
                    </div>
                    <div
                        className="dialogue-action-btn"
                        title="New Group"
                        onClick={() => createGroup(selectedLayerIds.length > 0 ? selectedLayerIds : undefined)}
                    >
                        <FolderPlus size={16} />
                    </div>
                    <div
                        className={`dialogue-action-btn${!activeLayerId ? ' disabled' : ''}`}
                        title="Delete Layer"
                        onClick={() => activeLayerId && deleteLayer(activeLayerId)}
                    >
                        <Trash2 size={16} />
                    </div>
                </div>
                <div className="dialogue-actions-right">
                    <div className="dialogue-action-btn"><Anchor size={16} /></div>
                </div>
            </div>

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
