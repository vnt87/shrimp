import { useState, useEffect, useMemo } from 'react'
import { X, Search } from 'lucide-react'

interface Shortcut {
    action: string
    keys: string
}

interface ShortcutGroup {
    name: string
    shortcuts: Shortcut[]
}

const shortcutData: ShortcutGroup[] = [
    {
        name: 'File',
        shortcuts: [
            { action: 'New Image', keys: '⌘N' },
            { action: 'Open File', keys: '⌘O' },
            { action: 'Save / Export as PNG', keys: '⌘S' },
        ],
    },
    {
        name: 'Edit',
        shortcuts: [
            { action: 'Undo', keys: '⌘Z' },
            { action: 'Redo', keys: '⇧⌘Z' },
            { action: 'Cut', keys: '⌘X' },
            { action: 'Copy', keys: '⌘C' },
            { action: 'Paste', keys: '⌘V' },
        ],
    },
    {
        name: 'Selection',
        shortcuts: [
            { action: 'Select All', keys: '⌘A' },
            { action: 'Select None / Deselect', keys: '⇧⌘A' },
            { action: 'Deselect', keys: '⌘D' },
        ],
    },
    {
        name: 'Tools',
        shortcuts: [
            { action: 'Move', keys: 'V' },
            { action: 'Crop', keys: 'C' },
            { action: 'Paintbrush', keys: 'B' },
            { action: 'Pencil', keys: 'N' },
            { action: 'Eraser', keys: '⇧E' },
            { action: 'Bucket Fill', keys: 'G' },
            { action: 'Gradient', keys: '⇧G' },
            { action: 'Rectangle Select', keys: 'R' },
            { action: 'Ellipse Select', keys: 'E' },
            { action: 'Color Picker', keys: 'I' },
            { action: 'Text', keys: 'T' },
            { action: 'Zoom', keys: 'Z' },
        ],
    },
    {
        name: 'Canvas',
        shortcuts: [
            { action: 'Pan / Navigate', keys: 'Space + Drag' },
            { action: 'Zoom In / Out', keys: 'Scroll Wheel' },
            { action: 'Increase Brush Size', keys: ']' },
            { action: 'Decrease Brush Size', keys: '[' },
            { action: 'Cancel Crop / Deselect', keys: 'Esc' },
        ],
    },
]

export default function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('')

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    const filtered = useMemo(() => {
        if (!query.trim()) return shortcutData
        const q = query.toLowerCase()
        return shortcutData
            .map((group) => ({
                ...group,
                shortcuts: group.shortcuts.filter(
                    (s) =>
                        s.action.toLowerCase().includes(q) ||
                        s.keys.toLowerCase().includes(q) ||
                        group.name.toLowerCase().includes(q)
                ),
            }))
            .filter((group) => group.shortcuts.length > 0)
    }, [query])

    const totalCount = filtered.reduce((n, g) => n + g.shortcuts.length, 0)

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
                {/* Title bar */}
                <div className="shortcuts-titlebar">
                    <span className="shortcuts-titlebar-text">Keyboard Shortcuts</span>
                    <div className="shortcuts-titlebar-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                {/* Search */}
                <div className="shortcuts-search-wrapper">
                    <Search size={14} className="shortcuts-search-icon" />
                    <input
                        className="shortcuts-search"
                        type="text"
                        placeholder="Search shortcuts…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {query && (
                        <span className="shortcuts-result-count">
                            {totalCount} result{totalCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="shortcuts-body">
                    {filtered.length === 0 ? (
                        <div className="shortcuts-empty">
                            No shortcuts matching "<strong>{query}</strong>"
                        </div>
                    ) : (
                        filtered.map((group) => (
                            <div key={group.name} className="shortcuts-group">
                                <div className="shortcuts-group-label">{group.name}</div>
                                {group.shortcuts.map((s) => (
                                    <div key={s.action} className="shortcuts-row">
                                        <span className="shortcuts-action">{s.action}</span>
                                        <kbd className="shortcuts-kbd">{s.keys}</kbd>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="shortcuts-footer">
                    <button className="pref-btn pref-btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}
