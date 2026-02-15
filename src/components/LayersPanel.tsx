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
    Undo2,
    Redo2,
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
        activePath,
        setActivePath,
        updatePath,
        toggleLayerLock,
        setLayerOpacity,
        setLayerBlendMode,
        addLayer,
        deleteLayer,
        duplicateLayer,
        createGroup,
        moveLayer,
        selectedLayerIds,
        undo,
        redo,
        canUndo,
        canRedo,
        historyEntries,
        historyCurrentIndex,
        restoreHistoryIndex
    } = useEditor()
    const [activeTab, setActiveTab] = useState<'layers' | 'channels' | 'paths' | 'history'>('layers')

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
    const opacityValue = Math.min(100, Math.max(0, activeLayer?.opacity ?? 100))

    const setOpacityValue = (value: number) => {
        if (activeLayerId) {
            setLayerOpacity(activeLayerId, Math.min(100, Math.max(0, value)))
        }
    }

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOpacityValue(Number(e.target.value))
    }

    const handleOpacityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(e.target.value)
        if (!Number.isNaN(nextValue)) {
            setOpacityValue(nextValue)
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

    const togglePathClosed = () => {
        if (!activePath) return
        if (!activePath.closed && activePath.points.length < 3) return
        updatePath({ ...activePath, closed: !activePath.closed })
    }

    return (
        <div className="dialogue" style={{ flex: 1, overflow: 'hidden' }}>
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <button type="button" className={`dialogue-tab dialogue-tab-btn ${activeTab === 'layers' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('layers')}>Layers</button>
                    <button type="button" className={`dialogue-tab dialogue-tab-btn ${activeTab === 'channels' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('channels')}>Channels</button>
                    <button type="button" className={`dialogue-tab dialogue-tab-btn ${activeTab === 'paths' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('paths')}>Paths</button>
                    <button type="button" className={`dialogue-tab dialogue-tab-btn ${activeTab === 'history' ? 'active' : 'inactive'}`} onClick={() => setActiveTab('history')}>History</button>
                </div>
                <div className="dialogue-more">
                    <MoreVertical size={16} />
                </div>
            </div>

            {activeTab === 'layers' && (
                <>
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
                            value={opacityValue}
                            style={{
                                background: `linear-gradient(to right, var(--accent-active) 0%, var(--accent-active) ${opacityValue}%, var(--bg-input) ${opacityValue}%, var(--bg-input) 100%)`
                            }}
                            onChange={handleOpacityChange}
                            disabled={!activeLayerId}
                        />
                        <input
                            type="number"
                            className="layers-opacity-input"
                            min={0}
                            max={100}
                            step={1}
                            value={opacityValue}
                            onChange={handleOpacityInputChange}
                            disabled={!activeLayerId}
                        />
                        <span className="layers-opacity-unit">%</span>
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
                </>
            )}

            {activeTab === 'paths' && (
                <>
                    <div className="layers-blend-row" style={{ justifyContent: 'space-between' }}>
                        <span className="dialogue-bar-label">Active Path</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {activePath ? `${activePath.points.length} pts` : 'None'}
                        </span>
                    </div>

                    <div className="dialogue-divider" />

                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            Status: {activePath ? (activePath.closed ? 'Closed' : 'Open') : 'No path'}
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className={`dialogue-action-btn${!activePath ? ' disabled' : ''}`}
                                onClick={togglePathClosed}
                                disabled={!activePath || (!activePath.closed && activePath.points.length < 3)}
                                title={activePath?.closed ? 'Open path' : 'Close path'}
                                style={{ width: 'auto', padding: '0 8px' }}
                            >
                                {activePath?.closed ? 'Open' : 'Close'}
                            </button>
                            <button
                                className={`dialogue-action-btn${!activePath ? ' disabled' : ''}`}
                                onClick={() => setActivePath(null)}
                                disabled={!activePath}
                                title="Clear path"
                                style={{ width: 'auto', padding: '0 8px' }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="dialogue-divider" />

                    <div className="layer-list" style={{ flex: 1, overflowY: 'auto' }}>
                        {!activePath && (
                            <div style={{ padding: 12, color: 'var(--text-secondary)', textAlign: 'center', fontSize: 12 }}>
                                No active path. Use the Paths tool (`P`) to create one.
                            </div>
                        )}
                        {activePath?.points.map((point, index) => (
                            <div key={`${activePath.id}-${index}`} className="layer-row" style={{ cursor: 'default' }}>
                                <div className="layer-info" style={{ gap: 8 }}>
                                    <div className="layer-folder-icon">
                                        <Anchor size={14} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span className="layer-name">{`Point ${index + 1}`}</span>
                                        <span className="layer-name muted" style={{ fontSize: 11 }}>
                                            {`x:${Math.round(point.x)} y:${Math.round(point.y)} · ${point.type}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'history' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px' }}>
                        <span className="dialogue-bar-label">History Log</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                type="button"
                                className={`dialogue-action-btn${!canUndo ? ' disabled' : ''}`}
                                title="Undo"
                                onClick={() => canUndo && undo()}
                                disabled={!canUndo}
                            >
                                <Undo2 size={14} />
                            </button>
                            <button
                                type="button"
                                className={`dialogue-action-btn${!canRedo ? ' disabled' : ''}`}
                                title="Redo"
                                onClick={() => canRedo && redo()}
                                disabled={!canRedo}
                            >
                                <Redo2 size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="dialogue-divider" />

                    <div className="layer-list" style={{ flex: 1, overflowY: 'auto' }}>
                        {[...historyEntries].reverse().map((entry) => (
                            <div
                                key={entry.index}
                                className={`layer-row${entry.isCurrent ? ' selected' : ''}`}
                                onDoubleClick={() => restoreHistoryIndex(entry.index)}
                                title="Double click to restore this state"
                                style={{ cursor: 'default' }}
                            >
                                <div className="layer-info" style={{ gap: 8 }}>
                                    <div className="layer-folder-icon">
                                        <Anchor size={14} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span className="layer-name">{entry.label}</span>
                                        <span className="layer-name muted" style={{ fontSize: 11 }}>
                                            {entry.isCurrent ? 'Current state' : `Step ${entry.index + 1}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="dialogue-divider" />

                    <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
                        Double-click any item to restore that state. Current: Step {historyCurrentIndex + 1}
                    </div>
                </>
            )}

            {(activeTab === 'channels') && (
                <>
                    <div className="dialogue-divider" />
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>
                        Channels panel is not implemented yet.
                    </div>
                </>
            )}

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
