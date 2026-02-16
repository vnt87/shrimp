import { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
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
        name: 'menu.file',
        shortcuts: [
            { action: 'menu.file.new', keys: '⌘N' },
            { action: 'menu.file.open', keys: '⌘O' },
            { action: 'menu.file.save', keys: '⌘S' },
        ],
    },
    {
        name: 'menu.edit',
        shortcuts: [
            { action: 'menu.edit.undo', keys: '⌘Z' },
            { action: 'menu.edit.redo', keys: '⇧⌘Z' },
            { action: 'menu.edit.cut', keys: '⌘X' },
            { action: 'menu.edit.copy', keys: '⌘C' },
            { action: 'menu.edit.paste', keys: '⌘V' },
        ],
    },
    {
        name: 'menu.select',
        shortcuts: [
            { action: 'menu.select.all', keys: '⌘A' },
            { action: 'menu.select.none', keys: '⇧⌘A' },
            { action: 'menu.select.invert', keys: '⇧⌘I' },
        ],
    },
    {
        name: 'menu.layer',
        shortcuts: [
            { action: 'menu.layer.merge_down', keys: '⌘E' },
        ],
    },
    {
        name: 'menu.help',
        shortcuts: [
            { action: 'tool.move', keys: 'V' },
            { action: 'tool.crop', keys: 'C' },
            { action: 'tool.brush', keys: 'B' },
            { action: 'tool.pencil', keys: 'N' },
            { action: 'tool.eraser', keys: '⇧E' },
            { action: 'tool.bucket', keys: 'G' },
            { action: 'tool.gradient', keys: '⇧G' },
            { action: 'tool.rect_select', keys: 'R' },
            { action: 'tool.ellipse_select', keys: 'E' },
            { action: 'tool.picker', keys: 'I' },
            { action: 'tool.text', keys: 'T' },
            { action: 'tool.zoom', keys: 'Z' },
            { action: 'tool.paths', keys: 'P' },
            { action: 'tool.clone', keys: 'S' },
        ],
    },
    {
        name: 'common.shrimp',
        shortcuts: [
            { action: 'header.search_placeholder', keys: '⌘/' },
            { action: 'toolbox.swap_title', keys: 'X' },
            { action: 'toolbox.reset_title', keys: 'D' },
            { action: 'tooloptions.size', keys: '[ ]' },
            { action: 'Cancel Crop / Deselect', keys: 'Esc' },
        ],
    },
]

export default function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
    const { t } = useLanguage()
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
        const q = query.toLowerCase().trim()
        if (!q) return shortcutData

        return shortcutData
            .map((group) => ({
                ...group,
                translatedName: t(group.name as any),
                shortcuts: group.shortcuts.filter(
                    (s) =>
                        t(s.action as any).toLowerCase().includes(q) ||
                        s.keys.toLowerCase().includes(q) ||
                        t(group.name as any).toLowerCase().includes(q)
                ),
            }))
            .filter((group) => group.shortcuts.length > 0)
    }, [query, t])

    const totalCount = filtered.reduce((n, g) => n + g.shortcuts.length, 0)

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
                {/* Title bar */}
                <div className="shortcuts-titlebar">
                    <span className="shortcuts-titlebar-text">{t('dialog.shortcuts.title')}</span>
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
                        placeholder={t('dialog.shortcuts.search_placeholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {query && (
                        <span className="shortcuts-result-count">
                            {totalCount} {totalCount === 1 ? t('dialog.shortcuts.result') : t('dialog.shortcuts.results')}
                        </span>
                    )}
                </div>

                {/* Body */}
                <div className="shortcuts-body">
                    {filtered.length === 0 ? (
                        <div className="shortcuts-empty">
                            {t('dialog.shortcuts.no_results')} "<strong>{query}</strong>"
                        </div>
                    ) : (
                        filtered.map((group) => (
                            <div key={group.name} className="shortcuts-group">
                                <div className="shortcuts-group-label">{t(group.name as any)}</div>
                                {group.shortcuts.map((s) => (
                                    <div key={s.action} className="shortcuts-row">
                                        <span className="shortcuts-action">{t(s.action as any)}</span>
                                        <kbd className="shortcuts-kbd">{s.keys}</kbd>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="shortcuts-footer">
                    <button className="pref-btn pref-btn-primary" onClick={onClose}>{t('dialog.shortcuts.close')}</button>
                </div>
            </div>
        </div>
    )
}
