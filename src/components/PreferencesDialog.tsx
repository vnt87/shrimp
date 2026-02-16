import { useState, useEffect } from 'react'
import {
    X,
    Cpu,
    Palette,
    FileInput,
    MousePointer2,
    Image as ImageIcon,
    Grid3X3,
    Layout,
    Paintbrush,
    Wrench,
    MessageSquare,
    HelpCircle,
    Monitor,
    AppWindow,
    Eye,
    Type,
    Magnet,
    Gamepad2,
    Joystick,
    FolderOpen as Folder, // Map FolderOpen to Folder for now if needed, or just import Folder
    ChevronDown,
    ChevronRight,
    Keyboard, // Added
    Search // Added
} from 'lucide-react'
import { useEditor } from './EditorContext'
import { useTheme } from './ThemeContext'
import { useLanguage } from '../i18n/LanguageContext'

// ── Icons ───────────────────────────────────────────────────────
// Fix icon mapping
const MousePointer = MousePointer2

// ── Sidebar tree structure ──────────────────────────────────────
interface SidebarItem {
    id: string
    label: string
    icon?: React.ReactNode // Made icon optional for children
    children?: SidebarItem[]
}

// ── Preference state ────────────────────────────────────────────
interface PrefsState {
    undoLevels: number
    maxUndoMemory: number
    undoMemoryUnit: string
    tileCacheSize: number
    tileCacheUnit: string
    maxImageSize: number
    imageSizeUnit: string
    swapCompression: string
    threads: number
    useOpenCL: boolean
    thumbnailSize: string
    maxThumbFilesize: number
    thumbFilesizeUnit: string
    keepDocHistory: boolean
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
    undoLevels: 5,
    maxUndoMemory: 2083269,
    undoMemoryUnit: 'Kilobytes',
    tileCacheSize: 8333076,
    tileCacheUnit: 'Kilobytes',
    maxImageSize: 128,
    imageSizeUnit: 'Megabytes',
    swapCompression: 'Best performance',
    threads: 8,
    useOpenCL: false,
    thumbnailSize: 'Normal (128x128)',
    maxThumbFilesize: 4,
    thumbFilesizeUnit: 'Megabytes',
    keepDocHistory: true,
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
export default function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
    const { t } = useLanguage() // Added
    const [activeItem, setActiveItem] = useState<string>('System Resources') // Changed initial state and type
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'Default Image': true, // Updated to match new IDs
        'Interface': true, // Updated to match new IDs
        'Display': true, // Updated to match new IDs
        'Image Windows': true, // Updated to match new IDs
        'Input Devices': true, // Updated to match new IDs
    })
    const { theme: currentTheme } = useTheme()
    const [prefs, setPrefs] = useState<PrefsState>(() => ({
        ...defaultPrefs,
        uiTheme: currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1),
    }))

    // Generate sidebar tree with translated labels
    const sidebarTree: SidebarItem[] = [
        {
            label: t('dialog.preferences.sidebar.system_resources'), icon: <Cpu size={14} />, id: 'System Resources', children: [
                { label: t('dialog.preferences.sidebar.resource_consumption'), id: 'Resource Consumption' },
                { label: t('dialog.preferences.sidebar.color_management'), id: 'Color Management' },
                { label: t('dialog.preferences.sidebar.image_import_export'), id: 'Image Import & Export' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.tool_options'), icon: <MousePointer size={14} />, id: 'Tool Options', children: [
                { label: t('dialog.preferences.sidebar.general'), id: 'Tool Options General' },
                { label: t('dialog.preferences.sidebar.snapping'), id: 'Snapping' },
                { label: t('dialog.preferences.sidebar.default_image'), id: 'Default Image' },
                { label: t('dialog.preferences.sidebar.default_grid'), id: 'Default Grid' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.interface'), icon: <Layout size={14} />, id: 'Interface', children: [
                { label: t('dialog.preferences.sidebar.theme'), id: 'Theme' },
                { label: t('dialog.preferences.sidebar.icon_theme'), id: 'Icon Theme' },
                { label: t('dialog.preferences.sidebar.toolbox'), id: 'Toolbox' },
                { label: t('dialog.preferences.sidebar.dialog_defaults'), id: 'Dialog Defaults' },
                { label: t('dialog.preferences.sidebar.help_system'), id: 'Help System' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.display'), icon: <Monitor size={14} />, id: 'Display', children: [
                { label: t('dialog.preferences.sidebar.window_management'), id: 'Window Management' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.image_windows'), icon: <ImageIcon size={14} />, id: 'Image Windows', children: [
                { label: t('dialog.preferences.sidebar.appearance'), id: 'Appearance' },
                { label: t('dialog.preferences.sidebar.title_status'), id: 'Title & Status' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.input_devices'), icon: <Keyboard size={14} />, id: 'Input Devices', children: [
                { label: t('dialog.preferences.sidebar.input_controllers'), id: 'Input Controllers' },
            ]
        },
        {
            label: t('dialog.preferences.sidebar.folders'), icon: <Folder size={14} />, id: 'Folders', children: [
                { label: t('dialog.preferences.sidebar.data'), id: 'Data' },
            ]
        }
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
        setPrefs((prev) => ({ ...prev, [key]: value }))
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
            case 'System Resources': // Updated ID
                return <SystemResourcesPage prefs={prefs} update={update} />
            case 'Color Management': // Updated ID
                return <ColorManagementPage prefs={prefs} update={update} />
            case 'Theme': // Updated ID
                return <ThemePage prefs={prefs} update={update} />
            case 'Toolbox': // Updated ID
                return <ToolboxPage prefs={prefs} update={update} />
            case 'Display': // Updated ID
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

function SystemResourcesPage({ prefs, update }: { prefs: PrefsState; update: UpdateFn }) {
    return (
        <>
            <PrefSection title="Resource Consumption">
                <PrefRow label="Minimal number of undo levels:">
                    <PrefSpinner value={prefs.undoLevels} onChange={(v) => update('undoLevels', v)} width={70} />
                </PrefRow>
                <PrefRow label="Maximum undo memory:">
                    <PrefSpinner value={prefs.maxUndoMemory} onChange={(v) => update('maxUndoMemory', v)} />
                    <PrefSelect value={prefs.undoMemoryUnit} options={['Kilobytes', 'Megabytes', 'Gigabytes']} onChange={(v) => update('undoMemoryUnit', v)} />
                </PrefRow>
                <PrefRow label="Tile cache size:">
                    <PrefSpinner value={prefs.tileCacheSize} onChange={(v) => update('tileCacheSize', v)} />
                    <PrefSelect value={prefs.tileCacheUnit} options={['Kilobytes', 'Megabytes', 'Gigabytes']} onChange={(v) => update('tileCacheUnit', v)} />
                </PrefRow>
                <PrefRow label="Maximum new image size:">
                    <PrefSpinner value={prefs.maxImageSize} onChange={(v) => update('maxImageSize', v)} width={70} />
                    <PrefSelect value={prefs.imageSizeUnit} options={['Kilobytes', 'Megabytes', 'Gigabytes']} onChange={(v) => update('imageSizeUnit', v)} />
                </PrefRow>
                <PrefRow label="Swap compression:">
                    <PrefSelect value={prefs.swapCompression} options={['Best performance', 'Balanced', 'Best compression']} onChange={(v) => update('swapCompression', v)} width={220} />
                </PrefRow>
                <PrefRow label="Number of threads to use:">
                    <PrefSpinner value={prefs.threads} onChange={(v) => update('threads', v)} width={70} />
                </PrefRow>
            </PrefSection>

            <PrefSection title="Hardware Acceleration">
                <PrefCheckbox checked={prefs.useOpenCL} label="Use OpenCL" onChange={(v) => update('useOpenCL', v)} />
                <div className="pref-warning">
                    <span className="pref-warning-icon">⚠</span>
                    <em>OpenCL drivers and support are experimental, expect slowdowns and possible crashes (please report).</em>
                </div>
            </PrefSection>

            <PrefSection title="Image Thumbnails">
                <PrefRow label="Size of thumbnails:">
                    <PrefSelect value={prefs.thumbnailSize} options={['No thumbnails', 'Normal (128x128)', 'Large (256x256)']} onChange={(v) => update('thumbnailSize', v)} width={220} />
                </PrefRow>
                <PrefRow label="Maximum filesize for thumbnailing:">
                    <PrefSpinner value={prefs.maxThumbFilesize} onChange={(v) => update('maxThumbFilesize', v)} width={70} />
                    <PrefSelect value={prefs.thumbFilesizeUnit} options={['Kilobytes', 'Megabytes']} onChange={(v) => update('thumbFilesizeUnit', v)} />
                </PrefRow>
            </PrefSection>

            <PrefSection title="Document History">
                <PrefCheckbox checked={prefs.keepDocHistory} label="Keep record of used files in the Recent Documents list" onChange={(v) => update('keepDocHistory', v)} />
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
