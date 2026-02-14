import { useState, useEffect, useRef } from 'react'
import {
    ChevronDown,
    Search,
    Save,
    Upload,
    Settings,
    ChevronRight,
    SlidersHorizontal,
    Puzzle,
    Sun,
    Moon,
    Monitor,
} from 'lucide-react'
import PreferencesDialog from './PreferencesDialog'
import AboutDialog from './AboutDialog'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import NewImageDialog from './NewImageDialog'
import ShrimpIcon from './ShrimpIcon'
import { useTheme } from './ThemeContext'
import { useEditor } from './EditorContext'

const menuData: Record<string, string[]> = {
    File: ['New...', 'Open...', 'Open as Layers...', 'Export As PNG', 'Export As JPEG', 'Export As WebP', 'Close', 'Close All'],
    Edit: ['Undo', 'Redo', '---', 'Cut', 'Copy', 'Paste', 'Clear'],
    Select: ['All', 'None', 'Invert'],
    View: ['Fit Image in Window', 'Zoom In', 'Zoom Out'],
    Image: ['Flatten Image', 'Merge Visible Layers', '---', 'Canvas Size...'],
    Layer: ['New Layer', 'Duplicate Layer', 'Delete Layer', '---', 'Merge Down'],
    Colors: ['Brightness-Contrast...', 'Hue-Saturation...', 'Desaturate...', 'Invert Colors'],
    Filters: ['Blur', 'Sharpen', 'Noise'],
    Windows: ['Toolbox', 'Layers', 'Brushes'],
    Help: ['Keyboard Shortcuts', 'About', 'Github Source'],
}

const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
]

export default function Header() {
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [autosave, setAutosave] = useState(true)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [showPreferences, setShowPreferences] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [showNewImage, setShowNewImage] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const settingsRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { theme, setTheme } = useTheme()
    const {
        undo, redo, canUndo, canRedo,
        selectAll, selectNone, invertSelection,
        flattenImage, mergeDown,
        exportImage,
        closeImage,
        addLayer, deleteLayer, duplicateLayer,
        activeLayerId, layers
    } = useEditor()

    // Key handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }

            const isCmd = e.metaKey || e.ctrlKey // Mac (Meta) or Windows (Ctrl)

            if (isCmd) {
                switch (e.key.toLowerCase()) {
                    case 'n':
                        e.preventDefault()
                        setShowNewImage(true)
                        break
                    case 'o':
                        e.preventDefault()
                        fileInputRef.current?.click()
                        break
                    case 's':
                        e.preventDefault()
                        if (layers.length > 0) exportImage('png')
                        break
                    case 'z':
                        e.preventDefault()
                        if (e.shiftKey) {
                            if (canRedo) redo()
                        } else {
                            if (canUndo) undo()
                        }
                        break
                    case 'a':
                        e.preventDefault()
                        if (e.shiftKey) selectNone()
                        else selectAll()
                        break
                    case 'd':
                        // Common for "Deselect" in standard image editors
                        e.preventDefault()
                        selectNone()
                        break
                    // 'w' is risky to override (Close Tab), skipping
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [undo, redo, canUndo, canRedo, selectAll, selectNone, layers, exportImage]) // Dependencies

    // Click outside handlers
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null)
            }
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setSettingsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleMenu = (item: string) => {
        setActiveMenu(activeMenu === item ? null : item)
    }

    const handleFileOpen = () => {
        fileInputRef.current?.click()
    }

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0)
                addLayer(file.name, canvas)
            }
            img.src = reader.result as string
        }
        reader.readAsDataURL(file)
        e.target.value = '' // Reset input
    }

    const handleMenuAction = (option: string) => {
        setActiveMenu(null)

        switch (option) {
            case 'New...': setShowNewImage(true); break
            case 'Open...': handleFileOpen(); break
            case 'Export As PNG': exportImage('png'); break
            case 'Export As JPEG': exportImage('jpeg', 0.92); break
            case 'Export As WebP': exportImage('webp', 0.9); break
            case 'Close': closeImage(); break
            case 'Close All': closeImage(); break
            case 'Undo': undo(); break
            case 'Redo': redo(); break
            case 'All': selectAll(); break
            case 'None': selectNone(); break
            case 'Invert': invertSelection(); break
            case 'Flatten Image': flattenImage(); break
            case 'Merge Visible Layers': flattenImage(); break
            case 'Merge Down': mergeDown(); break
            case 'New Layer': addLayer('New Layer'); break
            case 'Duplicate Layer': activeLayerId && duplicateLayer(activeLayerId); break
            case 'Delete Layer': activeLayerId && deleteLayer(activeLayerId); break
            case 'Keyboard Shortcuts': setShowShortcuts(true); break
            case 'About': setShowAbout(true); break
            case 'Github Source':
                window.open('https://github.com/vnt87/shrimp', '_blank')
                break
            default: break
        }
    }

    const isDisabled = (option: string): boolean => {
        switch (option) {
            case 'Undo': return !canUndo
            case 'Redo': return !canRedo
            case 'Export As PNG':
            case 'Export As JPEG':
            case 'Export As WebP':
            case 'Close':
            case 'Flatten Image':
            case 'Merge Visible Layers':
                return layers.length === 0
            case 'Duplicate Layer':
            case 'Delete Layer':
            case 'Merge Down':
                return !activeLayerId
            default: return false
        }
    }

    return (
        <>
            <header className="header">
                <div className="header-left">
                    <div className="header-brand">
                        <ShrimpIcon className="brand-icon" size={16} />
                        <span className="brand-text">SHRIMP</span>
                        <ChevronDown className="brand-caret" size={16} />
                    </div>
                    <nav className="header-menu" ref={menuRef}>
                        {Object.keys(menuData).map((item) => (
                            <div
                                key={item}
                                className={`header-menu-item${activeMenu === item ? ' active' : ''}`}
                                onClick={() => toggleMenu(item)}
                            >
                                {item}
                                {activeMenu === item && (
                                    <div className="header-menu-dropdown">
                                        {menuData[item].map((option, idx) => {
                                            if (option === '---') {
                                                return <div key={idx} className="header-menu-dropdown-divider" style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                                            }
                                            const disabled = isDisabled(option)
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`header-menu-dropdown-item${disabled ? ' disabled' : ''}`}
                                                    style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleMenuAction(option)
                                                    }}
                                                >
                                                    {option}
                                                    {getShortcut(option) && <span className="shortcut">{getShortcut(option)}</span>}
                                                    {['Open as Layers...', 'Blur', 'Sharpen', 'Noise'].includes(option) && (
                                                        <ChevronRight size={12} className="submenu-arrow" />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="header-right">
                    <div className="header-search">
                        <input type="text" placeholder="Search functions..." readOnly />
                        <Search className="search-icon" size={16} />
                    </div>

                    <div className="header-divider" />

                    <div className="header-toggle" onClick={() => setAutosave(!autosave)}>
                        <span className="header-toggle-label">Autosave</span>
                        <div className={`toggle ${autosave ? 'on' : 'off'}`} />
                    </div>

                    <div className="header-icon-btn" onClick={() => exportImage('png')} title="Save">
                        <Save size={16} />
                    </div>
                    <div className="header-icon-btn" onClick={handleFileOpen} title="Open">
                        <Upload size={16} />
                    </div>

                    <div className="header-divider" />

                    <div className="header-settings" ref={settingsRef} onClick={() => setSettingsOpen(!settingsOpen)}>
                        <Settings size={16} />
                        <ChevronDown size={16} />
                        {settingsOpen && (
                            <div className="settings-dropdown">
                                <div
                                    className="settings-dropdown-item"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSettingsOpen(false)
                                        setShowPreferences(true)
                                    }}
                                >
                                    <SlidersHorizontal size={14} />
                                    <span>App Preferences</span>
                                </div>
                                <div className="settings-dropdown-item">
                                    <Puzzle size={14} />
                                    <span>Integrations</span>
                                </div>
                                <div className="settings-dropdown-divider" />
                                <div className="settings-dropdown-section-label">Theme</div>
                                {themeOptions.map((opt) => (
                                    <div
                                        key={opt.value}
                                        className={`settings-dropdown-item${theme === opt.value ? ' selected' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setTheme(opt.value)
                                        }}
                                    >
                                        <opt.icon size={14} />
                                        <span>{opt.label}</span>
                                        {theme === opt.value && <span className="theme-check">✓</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
            />

            {showPreferences && <PreferencesDialog onClose={() => setShowPreferences(false)} />}
            {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
            {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
            {showNewImage && <NewImageDialog open={showNewImage} onClose={() => setShowNewImage(false)} />}
        </>
    )
}

function getShortcut(option: string): string {
    switch (option) {
        case 'New...': return '⌘N'
        case 'Open...': return '⌘O'
        case 'Undo': return '⌘Z'
        case 'Redo': return '⇧⌘Z'
        case 'Cut': return '⌘X'
        case 'Copy': return '⌘C'
        case 'Paste': return '⌘V'
        case 'All': return '⌘A'
        case 'None': return '⇧⌘A'
        default: return ''
    }
}
