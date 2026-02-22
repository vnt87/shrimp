import { useState, useEffect } from 'react'
import {
    X,
    ChevronDown,
    ChevronRight,
    Layout,
    History
} from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useLanguage } from '../i18n/LanguageContext'

// ── Sidebar tree structure ──────────────────────────────────────
interface SidebarItem {
    id: string
    label: string
    icon?: React.ReactNode // Made icon optional for children
    children?: SidebarItem[]
}

// ── Preference state ────────────────────────────────────────────
interface PrefsState {
    // History
    undoLevels: number
    historyMemoryMB: number
    // Color management
    colorProfile: string
    renderIntent: string
    softProofing: boolean
    // Theme
    uiTheme: string
    // Toolbox
    showToolGroups: boolean
    showLabels: boolean
    // Display
    monitorResolution: string
    canvasPadding: string
}

const defaultPrefs: PrefsState = {
    undoLevels: 50,
    historyMemoryMB: 500,
    colorProfile: 'sRGB IEC61966-2.1',
    renderIntent: 'Relative Colorimetric',
    softProofing: false,
    uiTheme: 'Dark',
    showToolGroups: true,
    showLabels: false,
    monitorResolution: 'Auto-detect',
    canvasPadding: 'From theme',
}

interface PreferencesDialogProps {
    open: boolean
    onClose: () => void
}

// ── Component ───────────────────────────────────────────────────
export default function PreferencesDialog({ open: _open, onClose }: PreferencesDialogProps) {
    const { t } = useLanguage() // Added
    const [activeItem, setActiveItem] = useState<string>('History') // Changed initial state and type
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'Interface': true,
        'System Resources': true,
    })
    const { theme: currentTheme } = useTheme()
    
    // Load stored preferences from localStorage
    const loadStoredPrefs = (): Partial<PrefsState> => {
        try {
            const stored = localStorage.getItem('shrimp_preferences');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };
    const storedPrefs = loadStoredPrefs();
    
    const [prefs, setPrefs] = useState<PrefsState>(() => ({
        ...defaultPrefs,
        uiTheme: currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1),
        ...storedPrefs, // Override with stored values
    }))

    // Generate sidebar tree with translated labels
    const sidebarTree: SidebarItem[] = [
        {
            label: t('dialog.preferences.sidebar.interface'), icon: <Layout size={14} />, id: 'Interface', children: [
                { label: t('dialog.preferences.sidebar.theme'), id: 'Theme' },
                { label: t('dialog.preferences.sidebar.toolbox'), id: 'Toolbox' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.system_resources'), icon: <History size={14} />, id: 'System Resources', children: [
                { label: t('dialog.preferences.sidebar.history'), id: 'History' },
                { label: t('dialog.preferences.sidebar.color_management'), id: 'Color Management' },
            ]
        },
    ]

    // Close on Escape
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

    const toggleExpand = (id: string) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const update = <K extends keyof PrefsState>(key: K, value: PrefsState[K]) => {
        setPrefs((prev) => {
            const newPrefs = { ...prev, [key]: value }
            // Save to localStorage
            try {
                localStorage.setItem('shrimp_preferences', JSON.stringify(newPrefs))
            } catch {
                console.warn('Failed to save preferences to localStorage')
            }
            return newPrefs
        })
    }

    // ── Find page title ─────────────────────────────────────────
    const getPageTitle = (): string => {
        for (const item of sidebarTree) {
            if (item.id === activeItem) return item.label
            if (item.children) {
                for (const child of item.children) {
                    if (child.id === activeItem) return child.label
                }
            }
        }
        return ''
    }

    // ── Sidebar renderer ────────────────────────────────────────
    const renderSidebarItem = (item: SidebarItem, depth = 0) => {
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expanded[item.id]
        const isActive = activeItem === item.id

        return (
            <div key={item.id}>
                <div
                    className={`pref-sidebar-item${isActive ? ' active' : ''}`}
                    style={{ paddingLeft: 8 + depth * 16 }}
                    onClick={() => {
                        setActiveItem(item.id)
                        if (hasChildren) toggleExpand(item.id)
                    }}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown size={12} className="pref-caret" /> : <ChevronRight size={12} className="pref-caret" />
                    ) : (
                        <span style={{ width: 12, display: 'inline-block' }} />
                    )}
                    {item.icon && <span className="pref-sidebar-icon">{item.icon}</span>} {/* Render icon only if present */}
                    <span className="pref-sidebar-label">{item.label}</span>
                </div>
                {hasChildren && isExpanded && item.children!.map((child) => renderSidebarItem(child, depth + 1))}
            </div>
        )
    }

    // ── Content pages ───────────────────────────────────────────
    const renderContent = () => {
        switch (activeItem) {
            case 'History':
                return <HistoryPage prefs={prefs} update={update} />
            case 'Color Management':
                return <ColorManagementPage prefs={prefs} update={update} />
            case 'Theme':
                return <ThemePage prefs={prefs} update={update} />
            case 'Toolbox':
                return <ToolboxPage prefs={prefs} update={update} />
            case 'Display':
                return <DisplayPage prefs={prefs} update={update} />
            default:
                return <PlaceholderPage title={getPageTitle()} />
        }
    }

    return (
        <div className="pref-overlay" onClick={onClose}>
            <div className="pref-dialog" onClick={(e) => e.stopPropagation()}>
                {/* Title bar */}
                <div className="pref-titlebar">
                    <span className="pref-titlebar-text">Preferences</span>
                    <div className="pref-titlebar-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                {/* Body */}
                <div className="pref-body">
                    <div className="pref-sidebar">
                        {sidebarTree.map((item) => renderSidebarItem(item))}
                    </div>
                    <div className="pref-content">
                        <h2 className="pref-page-title">{getPageTitle()}</h2>
                        <div className="pref-page-divider" />
                        <div className="pref-page-body">
                            {renderContent()}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pref-footer">
                    <button className="pref-btn pref-btn-secondary">
                        {t('dialog.preferences.help')}
                    </button>
                    <div className="pref-footer-right">
                        <button className="pref-btn pref-btn-secondary" onClick={() => setPrefs({ ...defaultPrefs })}>
                            {t('dialog.preferences.reset')}
                        </button>
                        <button className="pref-btn pref-btn-primary" onClick={onClose}>
                            {t('dialog.preferences.ok')}
                        </button>
                        <button className="pref-btn pref-btn-secondary" onClick={onClose}>
                            {t('dialog.preferences.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Helper components ───────────────────────────────────────────
type UpdateFn = <K extends keyof PrefsState>(key: K, value: PrefsState[K]) => void

function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="pref-row">
            <label className="pref-label">{label}</label>
            <div className="pref-control">{children}</div>
        </div>
    )
}

function PrefSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="pref-section">
            <h3 className="pref-section-title">{title}</h3>
            {children}
        </div>
    )
}

function PrefCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
    return (
        <div className="pref-checkbox" onClick={() => onChange(!checked)}>
            <div className={`pref-checkbox-box ${checked ? 'checked' : ''}`}>
                {checked && <span>✕</span>}
            </div>
            <span>{label}</span>
        </div>
    )
}

function PrefSpinner({ value, onChange, width = 90 }: { value: number; onChange: (v: number) => void; width?: number }) {
    return (
        <div className="pref-spinner" style={{ width }}>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <div className="pref-spinner-btns">
                <button onClick={() => onChange(value + 1)}>▲</button>
                <button onClick={() => onChange(value - 1)}>▼</button>
            </div>
        </div>
    )
}

function PrefSelect({ value, options, onChange, width }: { value: string; options: string[]; onChange: (v: string) => void; width?: number }) {
    return (
        <select
            className="pref-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={width ? { width } : undefined}
        >
            {options.map((o) => (
                <option key={o} value={o}>{o}</option>
            ))}
        </select>
    )
}

// ── Pages ───────────────────────────────────────────────────────

function HistoryPage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    return (
        <>
            <PrefSection title="History Limits">
                <PrefRow label="Maximum history entries:">
                    <PrefSpinner value={prefs.undoLevels} onChange={(v) => update('undoLevels', Math.max(1, Math.min(200, v)))} width={70} />
                </PrefRow>
                <PrefRow label="Memory limit (MB):">
                    <PrefSpinner value={prefs.historyMemoryMB} onChange={(v) => update('historyMemoryMB', Math.max(100, Math.min(2000, v)))} width={90} />
                </PrefRow>
                <div className="pref-info">
                    <strong>Recommended values:</strong><br />
                    • 20-30 entries: Basic usage, limited memory<br />
                    • 50 entries: Default, balanced performance<br />
                    • 100+ entries: Power users, more memory usage<br />
                    <br />
                    <strong>Memory limit:</strong><br />
                    • 200-300 MB: Small canvases<br />
                    • 500 MB: Default, works for most cases<br />
                    • 1000+ MB: Large documents with many layers<br />
                    <br />
                    Higher values allow more undo steps but consume more memory.
                    Changes take effect after restarting the app.
                </div>
            </PrefSection>
            <PrefSection title="History Storage">
                <div className="pref-info">
                    History is automatically saved with your document.
                    When memory limit is reached, older history entries are automatically removed.
                </div>
            </PrefSection>
        </>
    )
}

function ColorManagementPage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    return (
        <>
            <PrefSection title="Color Profile">
                <PrefRow label="RGB profile:">
                    <PrefSelect value={prefs.colorProfile} options={['sRGB IEC61966-2.1', 'Adobe RGB (1998)', 'ProPhoto RGB', 'Display P3']} onChange={(v) => update('colorProfile', v)} width={220} />
                </PrefRow>
                <PrefRow label="Rendering intent:">
                    <PrefSelect value={prefs.renderIntent} options={['Perceptual', 'Relative Colorimetric', 'Saturation', 'Absolute Colorimetric']} onChange={(v) => update('renderIntent', v)} width={220} />
                </PrefRow>
            </PrefSection>

            <PrefSection title="Soft Proofing">
                <PrefCheckbox checked={prefs.softProofing} label="Enable soft proofing" onChange={(v) => update('softProofing', v)} />
            </PrefSection>
        </>
    )
}

function ThemePage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    const { setTheme } = useTheme()

    const handleThemeChange = (v: string) => {
        update('uiTheme', v)
        const mapped = v.toLowerCase() as 'dark' | 'light' | 'system'
        setTheme(mapped)
    }

    return (
        <PrefSection title="UI Theme">
            <PrefRow label="Theme:">
                <PrefSelect value={prefs.uiTheme} options={['Dark', 'Light', 'System']} onChange={handleThemeChange} width={160} />
            </PrefRow>
            <div className="pref-info">Theme changes are applied instantly.</div>
        </PrefSection>
    )
}

function ToolboxPage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    return (
        <PrefSection title="Toolbox Configuration">
            <PrefCheckbox checked={prefs.showToolGroups} label="Use tool groups" onChange={(v) => update('showToolGroups', v)} />
            <PrefCheckbox checked={prefs.showLabels} label="Show tool labels" onChange={(v) => update('showLabels', v)} />
        </PrefSection>
    )
}

function DisplayPage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    return (
        <>
            <PrefSection title="Monitor">
                <PrefRow label="Monitor resolution:">
                    <PrefSelect value={prefs.monitorResolution} options={['Auto-detect', '72 dpi', '96 dpi', '144 dpi']} onChange={(v) => update('monitorResolution', v)} width={160} />
                </PrefRow>
            </PrefSection>

            <PrefSection title="Canvas Appearance">
                <PrefRow label="Canvas padding mode:">
                    <PrefSelect value={prefs.canvasPadding} options={['From theme', 'Light check color', 'Dark check color', 'Custom color']} onChange={(v) => update('canvasPadding', v)} width={180} />
                </PrefRow>
            </PrefSection>
        </>
    )
}

function PlaceholderPage({ title }: { title: string }) {
    return (
        <div className="pref-placeholder">
            <span className="pref-placeholder-text">{title} preferences will be available in a future update.</span>
        </div>
    )
}
