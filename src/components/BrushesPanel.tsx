import {
    MoreVertical,
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

const brushVariants = [
    1, 2, 3, 4, 5, 1, 2, 3, 4, 5,
    1, 2, 3, 4, 5, 1, 2, 3, 4, 5,
    1, 2, 3, 4, 5,
]

export default function BrushesPanel() {
    return (
        <div className="dialogue" style={{ height: 310 }}>
            {/* Header tabs */}
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <div className="dialogue-tab active">Brushes</div>
                    <div className="dialogue-tab inactive">Gradient</div>
                    <div className="dialogue-tab inactive">Text Styles</div>
                </div>
                <div className="dialogue-more">
                    <MoreVertical size={16} />
                </div>
            </div>

            {/* Search bar */}
            <div className="dialogue-bar">
                <div className="dialogue-input" style={{ flex: 1 }}>
                    <input type="text" placeholder="Quick Filter..." readOnly />
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

            {/* Brush grid */}
            <div className="brush-grid-container" style={{ height: 220 }}>
                {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="brush-grid-row">
                        {[0, 1, 2, 3, 4].map((col) => {
                            const idx = row * 5 + col
                            const variant = brushVariants[idx] || 1
                            return (
                                <div key={col} className="brush-cell">
                                    <div className={`brush-cell-inner variant-${variant}`} />
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            <div className="dialogue-divider" />

            {/* Actions */}
            <div className="dialogue-actions">
                <div className="dialogue-actions-left">
                    <div className="dialogue-action-btn"><Plus size={16} /></div>
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
