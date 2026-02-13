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

interface LayerItem {
    name: string
    type: 'group' | 'layer'
    indent: boolean
    thumbCount?: number
    locked?: boolean
    linked?: boolean | 'off'
    visible?: boolean
    selected?: boolean
}

const layers: LayerItem[] = [
    { name: 'Layer Group', type: 'group', indent: false, linked: true, visible: true },
    { name: 'Layer 1', type: 'layer', indent: true, thumbCount: 2, locked: true, linked: true, visible: true },
    { name: 'Layer 2', type: 'layer', indent: true, thumbCount: 1, linked: 'off', visible: true },
    { name: 'Layer 3', type: 'layer', indent: false, visible: true },
    { name: 'Layer 4', type: 'layer', indent: false, visible: false },
    { name: 'Layer 5', type: 'layer', indent: false, locked: true, visible: true, selected: true },
]

export default function LayersPanel() {
    return (
        <div className="dialogue" style={{ height: 524 }}>
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
                    <span>Overlay</span>
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
                <div className="layers-lock-icon"><Lock size={16} /></div>
                <span className="layers-opacity-label">Opacity</span>
                <input
                    type="range"
                    className="layers-opacity-slider"
                    min={0}
                    max={100}
                    defaultValue={77}
                />
                <div className="layers-opacity-dropdown">
                    <span>77%</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            <div className="dialogue-divider" />

            {/* Layer list */}
            <div className="layer-list">
                {layers.map((layer, i) => (
                    <div
                        key={i}
                        className={`layer-row${layer.selected ? ' selected' : ''}`}
                    >
                        <div className="layer-info">
                            {layer.indent && (
                                <div className="layer-indent">
                                    <ChevronRight size={10} />
                                </div>
                            )}
                            {layer.type === 'group' ? (
                                <div className="layer-folder-icon">
                                    <FolderOpen size={16} />
                                </div>
                            ) : (
                                <>
                                    {Array.from({ length: layer.thumbCount || 1 }).map((_, ti) => (
                                        <div key={ti} className="layer-thumb">
                                            <img src="/cathedral.jpg" alt="" />
                                        </div>
                                    ))}
                                </>
                            )}
                            <span className={`layer-name${layer.visible === false ? ' muted' : ''}`}>
                                {layer.name}
                            </span>
                        </div>
                        <div className="layer-status">
                            {layer.locked && (
                                <div className="layer-status-icon">
                                    <Lock size={16} />
                                </div>
                            )}
                            {layer.linked === true && (
                                <div className="layer-status-icon">
                                    <Link size={16} />
                                </div>
                            )}
                            {layer.linked === 'off' && (
                                <div className="layer-status-icon off">
                                    <Unlink size={16} />
                                </div>
                            )}
                            {layer.visible === true && (
                                <div className="layer-status-icon">
                                    <Eye size={16} />
                                </div>
                            )}
                            {layer.visible === false && (
                                <div className="layer-status-icon off">
                                    <EyeOff size={16} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Empty rows */}
                {[0, 1].map((i) => (
                    <div key={`empty-${i}`} className="layer-row" style={{ height: 32 }} />
                ))}
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
                    <div className="dialogue-action-btn"><Plus size={16} /></div>
                    <div className="dialogue-action-btn"><Copy size={16} /></div>
                    <div className="dialogue-action-btn"><FolderPlus size={16} /></div>
                    <div className="dialogue-action-btn"><Trash2 size={16} /></div>
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
