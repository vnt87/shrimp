import { useState, useEffect, useRef } from 'react'
import {
    ChevronDown,
    Search,
    Settings,
    SlidersHorizontal,
    Puzzle,
    ChevronRight,
    Sun,
    Moon,
    Monitor,
    Check,
} from 'lucide-react'
import PreferencesDialog from './PreferencesDialog'
import AboutDialog from './AboutDialog'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import NewImageDialog from './NewImageDialog'
import ShrimpIcon from './ShrimpIcon'
import { useTheme } from './ThemeContext'
import { useEditor, type LayerFilter } from './EditorContext'
import { useLayout } from './LayoutContext'
import { useLanguage } from '../i18n/LanguageContext'
import FiltersDialog from './FiltersDialog'

import { MENU_TOOL_GROUPS } from '../data/tools'
import { FILTER_CATALOG, isSupportedFilterType } from '../data/filterCatalog'

type MenuOption = string | { label: string; icon?: any; command?: string; shortcut?: string; disabled?: boolean; children?: MenuOption[] }

// staticMenuData removed in favor of dynamic generation inside component

const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
]

export default function Header({ onToolSelect }: { onToolSelect?: (tool: string) => void }) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [autosave, setAutosave] = useState(true)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [showPreferences, setShowPreferences] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [showNewImage, setShowNewImage] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [initialFilterType, setInitialFilterType] = useState<LayerFilter['type']>('blur')
    const menuRef = useRef<HTMLDivElement>(null)
    const settingsRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { theme, setTheme } = useTheme()
    const { t, language, setLanguage } = useLanguage()
    const { panels, togglePanelVisibility } = useLayout()
    const {
        undo, redo, canUndo, canRedo,
        selectAll, selectNone, invertSelection,
        flattenImage, mergeDown,
        exportImage,
        closeImage,
        openImage,
        addLayer, deleteLayer, duplicateLayer,
        activeLayerId, layers,
        swapColors
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
                        handleMenuAction('New...')
                        break
                    case 'o':
                        e.preventDefault()
                        handleMenuAction('Open...')
                        break
                    case 's':
                        e.preventDefault()
                        handleMenuAction('Save') // Not implemented yet
                        break
                    case 'z':
                        e.preventDefault()
                        if (e.shiftKey) {
                            handleMenuAction('Redo')
                        } else {
                            handleMenuAction('Undo')
                        }
                        break
                    case 'a':
                        e.preventDefault()
                        if (e.shiftKey) {
                            handleMenuAction('None')
                        } else {
                            handleMenuAction('All')
                        }
                        break
                    case 'i':
                        if (e.shiftKey) {
                            e.preventDefault()
                            handleMenuAction('Invert')
                        }
                        break
                    case 'e':
                        e.preventDefault()
                        handleMenuAction('Merge Down')
                        break
                }
            } else {
                switch (e.key) {
                    case 'x':
                        swapColors()
                        break
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activeLayerId, layers, swapColors])

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

    const handleMenuAction = (option: string | MenuOption) => {
        const command = typeof option === 'string' ? option : option.command || option.label

        // Handle tool commands
        if (command.startsWith('tool:')) {
            const toolId = command.split(':')[1]
            onToolSelect?.(toolId)
            setActiveMenu(null)
            return
        }

        // Handle panel commands
        if (command.startsWith('toggle-panel:')) {
            const panelId = command.split(':')[1] as keyof typeof panels
            togglePanelVisibility(panelId)
            setActiveMenu(null)
            return
        }

        if (command.startsWith('filter:')) {
            const filterId = command.split(':')[1]
            if (isSupportedFilterType(filterId as any)) {
                setInitialFilterType(filterId as LayerFilter['type'])
                setShowFilters(true)
            }
            setActiveMenu(null)
            return
        }

        switch (command) {
            case 'New...': setShowNewImage(true); break
            case 'Open...':
                if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*'
                    fileInputRef.current.onchange = (e: any) => {
                        const file = e.target.files[0]
                        if (file) {
                            const reader = new FileReader()
                            reader.onload = () => {
                                const img = new Image()
                                img.onload = () => {
                                    const canvas = document.createElement('canvas')
                                    canvas.width = img.width
                                    canvas.height = img.height
                                    const ctx = canvas.getContext('2d')
                                    ctx?.drawImage(img, 0, 0)
                                    openImage(file.name, canvas)
                                }
                                img.src = reader.result as string
                            }
                            reader.readAsDataURL(file)
                        }
                    }
                    fileInputRef.current.click()
                }
                break
            case 'Open as Layers...':
                if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*'
                    fileInputRef.current.onchange = (e: any) => {
                        const file = e.target.files[0]
                        if (file) {
                            const reader = new FileReader()
                            reader.onload = () => {
                                const img = new Image()
                                img.onload = () => {
                                    const canvas = document.createElement('canvas')
                                    canvas.width = img.width
                                    canvas.height = img.height
                                    const ctx = canvas.getContext('2d')
                                    ctx?.drawImage(img, 0, 0)
                                    // For now, Open as Layers just opens as new image as well,
                                    // properly implementing "add layer from file" would require a new context method
                                    openImage(file.name, canvas)
                                }
                                img.src = reader.result as string
                            }
                            reader.readAsDataURL(file)
                        }
                    }
                    fileInputRef.current.click()
                }
                break
            case 'Export As PNG': exportImage('png'); break
            case 'Export As JPEG': exportImage('jpeg'); break
            case 'Export As WebP': exportImage('webp'); break
            case 'Close': closeImage(); break
            case 'Close All': closeImage(); break
            case 'Undo': undo(); break
            case 'Redo': redo(); break
            case 'Cut': /* Implement cut */ break
            case 'Copy': /* Implement copy */ break
            case 'Paste': /* Implement paste */ break
            case 'Clear': /* Implement clear */ break
            case 'Free Transform': /* Implement transform */ break
            case 'All': selectAll(); break
            case 'None': selectNone(); break
            case 'Invert': invertSelection(); break
            case 'Flatten Image': flattenImage(); break
            case 'Merge Visible Layers': /* Implement merge visible */ break
            case 'Merge Down': mergeDown(); break
            case 'Canvas Size...': /* Implement canvas resize */ break
            case 'New Layer': addLayer(); break
            case 'Duplicate Layer': activeLayerId && duplicateLayer(activeLayerId); break
            case 'Delete Layer':
                if (activeLayerId) deleteLayer(activeLayerId)
                break
            case 'Brightness-Contrast...':
                setInitialFilterType('brightness')
                setShowFilters(true)
                break
            case 'Hue-Saturation...':
                setInitialFilterType('hue-saturation')
                setShowFilters(true)
                break
            case 'Desaturate...':
                // Could be a one-click action or open Hue-Sat with sat=-100
                setInitialFilterType('hue-saturation')
                setShowFilters(true)
                break
            case 'Invert Colors':
                // No direct filter for this yet, maybe color matrix?
                // Placeholder or skip for color-matrix for now
                break
            case 'Keyboard Shortcuts': setShowShortcuts(true); break
            case 'About': setShowAbout(true); break
            case 'Github Source': window.open('https://github.com/vunam/webgimp', '_blank'); break
        }
        setActiveMenu(null)
    }

    const isDisabled = (command: string) => {
        if (command === 'Undo') return !canUndo
        if (command === 'Redo') return !canRedo
        if (['Duplicate Layer', 'Delete Layer', 'Merge Down', 'Cut', 'Copy', 'Clear', 'Free Transform', 'Invert Colors', 'Desaturate...'].includes(command)) {
            return !activeLayerId
        }
        return false
    }

    // Dynamic menu data merging
    const menuData: Record<string, MenuOption[]> = {
        [t('menu.file')]: [
            { label: t('menu.file.new'), command: 'New...' },
            { label: t('menu.file.open'), command: 'Open...' },
            { label: t('menu.file.open_layers'), command: 'Open as Layers...' },
            { label: t('menu.file.export_png'), command: 'Export As PNG' },
            { label: t('menu.file.export_jpeg'), command: 'Export As JPEG' },
            { label: t('menu.file.export_webp'), command: 'Export As WebP' },
            { label: t('menu.file.close'), command: 'Close' },
            { label: t('menu.file.close_all'), command: 'Close All' }
        ],
        [t('menu.edit')]: [
            { label: t('menu.edit.undo'), command: 'Undo' },
            { label: t('menu.edit.redo'), command: 'Redo' },
            '---',
            { label: t('menu.edit.cut'), command: 'Cut' },
            { label: t('menu.edit.copy'), command: 'Copy' },
            { label: t('menu.edit.paste'), command: 'Paste' },
            { label: t('menu.edit.clear'), command: 'Clear' },
            '---',
            { label: t('menu.edit.free_transform'), command: 'Free Transform' },
            '---',
            ...MENU_TOOL_GROUPS.map(group => ({
                label: t(group.label as any),
                children: group.tools.map(tool => ({
                    label: t(tool.label as any),
                    icon: tool.icon,
                    command: `tool:${tool.id}`
                }))
            }))
        ],
        [t('menu.select')]: [
            { label: t('menu.select.all'), command: 'All' },
            { label: t('menu.select.none'), command: 'None' },
            { label: t('menu.select.invert'), command: 'Invert' }
        ],
        [t('menu.view')]: [
            { label: t('menu.view.fit'), command: 'Fit Image in Window' },
            { label: t('menu.view.zoom_in'), command: 'Zoom In' },
            { label: t('menu.view.zoom_out'), command: 'Zoom Out' }
        ],
        [t('menu.image')]: [
            { label: t('menu.image.flatten'), command: 'Flatten Image' },
            { label: t('menu.image.merge_visible'), command: 'Merge Visible Layers' },
            '---',
            { label: t('menu.image.canvas_size'), command: 'Canvas Size...' }
        ],
        [t('menu.layer')]: [
            { label: t('menu.layer.new'), command: 'New Layer' },
            { label: t('menu.layer.duplicate'), command: 'Duplicate Layer' },
            { label: t('menu.layer.delete'), command: 'Delete Layer' },
            '---',
            { label: t('menu.layer.merge_down'), command: 'Merge Down' }
        ],
        [t('menu.colors')]: [
            { label: t('menu.colors.brightness_contrast'), command: 'Brightness-Contrast...' },
            { label: t('menu.colors.hue_saturation'), command: 'Hue-Saturation...' },
            { label: t('menu.colors.desaturate'), command: 'Desaturate...' },
            { label: t('menu.colors.invert'), command: 'Invert Colors' }
        ],
        [t('menu.adjustment_layers')]: FILTER_CATALOG.map((filter) => ({
            label: t(filter.menuLabel as any),
            command: `filter:${filter.id}`
        })),
        [t('menu.windows')]: [
            { label: t('menu.windows.brushes'), icon: panels.brushes.visible ? Check : undefined, command: 'toggle-panel:brushes' },
            { label: t('menu.windows.layers'), icon: panels.layers.visible ? Check : undefined, command: 'toggle-panel:layers' },
            { label: t('menu.windows.histogram'), icon: panels.histogram.visible ? Check : undefined, command: 'toggle-panel:histogram' },
        ],
        [t('menu.help')]: [
            { label: t('menu.help.shortcuts'), command: 'Keyboard Shortcuts' },
            { label: t('menu.help.about'), command: 'About' },
            { label: t('menu.help.source'), command: 'Github Source' }
        ],
    }

    return (
        <>
            <div className="header">
                <div className="header-left">
                    <div className="header-brand" onClick={() => setShowAbout(true)}>
                        <ShrimpIcon className="brand-icon" />
                        <span className="brand-text">{t('common.shrimp')}</span>
                        <ChevronDown className="brand-caret" size={12} strokeWidth={3} />
                    </div>

                    <div className="header-menu" ref={menuRef}>
                        {Object.keys(menuData).map((key) => (
                            <div
                                key={key}
                                className={`header-menu-item ${activeMenu === key ? 'active' : ''}`}
                                onClick={() => setActiveMenu(activeMenu === key ? null : key)}
                                onMouseEnter={() => activeMenu && setActiveMenu(key)}
                            >
                                {key}
                                {activeMenu === key && (
                                    <div className="header-menu-dropdown">
                                        {menuData[key].map((option, idx) => (
                                            <MenuItem
                                                key={idx}
                                                option={option}
                                                handleMenuAction={handleMenuAction}
                                                isDisabled={isDisabled}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="header-right">
                    <div className="header-search">
                        <Search className="search-icon" />
                        <input type="text" placeholder={t('header.search_placeholder')} />
                    </div>

                    <div className="header-divider" />

                    <div className="header-toggle" onClick={() => setAutosave(!autosave)} title={t('header.autosave')}>
                        <div className={`toggle ${autosave ? 'on' : 'off'}`} />
                        <span className="header-toggle-label">{t('header.autosave')}</span>
                    </div>

                    <div className="header-divider" />

                    <div className="header-icon-btn" title={t('header.themeSettings')} onClick={() => setSettingsOpen(!settingsOpen)} ref={settingsRef}>
                        <Settings />
                        <ChevronDown size={12} strokeWidth={3} style={{ marginLeft: 4, width: 12, height: 12 }} />
                        {settingsOpen && (
                            <div className="header-menu-dropdown" style={{ right: 8, left: 'auto', minWidth: 150 }}>
                                <div
                                    className="header-menu-dropdown-item"
                                    onClick={() => {
                                        setSettingsOpen(false)
                                        setShowPreferences(true)
                                    }}
                                >
                                    <SlidersHorizontal size={14} style={{ marginRight: 8 }} />
                                    {t('header.settings.preferences')}
                                </div>
                                <div className="header-menu-dropdown-item">
                                    <Puzzle size={14} style={{ marginRight: 8 }} />
                                    {t('header.settings.integrations')}
                                </div>
                                <div className="header-menu-dropdown-divider" style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

                                <div className="header-menu-dropdown-item" style={{ cursor: 'default', fontSize: 11, color: 'var(--text-secondary)', padding: '4px 12px' }}>
                                    {t('header.settings.theme')}
                                </div>
                                {themeOptions.map((opt) => (
                                    <div
                                        key={opt.value}
                                        className="header-menu-dropdown-item"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setTheme(opt.value)
                                            setSettingsOpen(false)
                                        }}
                                    >
                                        <opt.icon size={14} style={{ marginRight: 8 }} />
                                        {t(`header.settings.theme.${opt.value}` as any)}
                                        {theme === opt.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                    </div>
                                ))}

                                <div className="header-menu-dropdown-divider" style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

                                <div className="header-menu-dropdown-item" style={{ cursor: 'default', fontSize: 11, color: 'var(--text-secondary)', padding: '4px 12px' }}>
                                    {t('header.settings.language')}
                                </div>

                                <div
                                    className="header-menu-dropdown-item"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setLanguage('en')
                                        setSettingsOpen(false)
                                    }}
                                >
                                    <span style={{ marginRight: 8, fontSize: 14 }}>🇺🇸</span>
                                    English
                                    {language === 'en' && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                </div>
                                <div
                                    className="header-menu-dropdown-item"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setLanguage('vi')
                                        setSettingsOpen(false)
                                    }}
                                >
                                    <span style={{ marginRight: 8, fontSize: 14 }}>🇻🇳</span>
                                    Tiếng Việt
                                    {language === 'vi' && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <input type="file" ref={fileInputRef} style={{ display: 'none' }} />

            {showPreferences && <PreferencesDialog open={showPreferences} onClose={() => setShowPreferences(false)} />}
            {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
            {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
            {showNewImage && <NewImageDialog open={showNewImage} onClose={() => setShowNewImage(false)} />}
            {showFilters && <FiltersDialog initialFilterType={initialFilterType} onClose={() => setShowFilters(false)} />}
        </>
    )
}

function getShortcut(command: string) {
    switch (command) {
        case 'New...': return '⌘N'
        case 'Open...': return '⌘O'
        case 'Save': return '⌘S'
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

function MenuItem({ option, handleMenuAction, isDisabled }: { option: MenuOption, handleMenuAction: (opt: MenuOption) => void, isDisabled: (label: string) => boolean }) {
    const [isOpen, setIsOpen] = useState(false)

    if (option === '---') {
        return <div className="header-menu-dropdown-divider" style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
    }

    const label = typeof option === 'string' ? option : option.label
    const command = typeof option === 'string' ? option : option.command || option.label
    const disabled = isDisabled(command)
    const Icon = typeof option !== 'string' ? option.icon : null
    const children = typeof option !== 'string' ? option.children : undefined
    const hasSubmenu = !!children

    return (
        <div
            className={`header-menu-dropdown-item${disabled ? ' disabled' : ''}`}
            style={{
                ...((disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined) as any),
                position: 'relative'
            }}
            onClick={(e) => {
                if (children) return
                e.stopPropagation()
                handleMenuAction(option)
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            {Icon && <Icon size={14} style={{ marginRight: 8 }} />}
            {label}
            {getShortcut(command) && <span className="shortcut">{getShortcut(command)}</span>}
            {hasSubmenu && (
                <ChevronRight size={12} className="submenu-arrow" style={{ marginLeft: 'auto' }} />
            )}

            {children && isOpen && (
                <div
                    className="header-menu-dropdown"
                    style={{
                        top: -4,
                        left: '100%',
                        marginLeft: -2, // Overlap slightly
                    }}
                >
                    {children.map((child, idx) => (
                        <MenuItem key={idx} option={child} handleMenuAction={handleMenuAction} isDisabled={isDisabled} />
                    ))}
                </div>
            )}
        </div>
    )
}
