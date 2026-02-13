import { useState, useEffect, useRef } from 'react'
import {
    ChevronDown,
    Search,
    Save,
    Upload,
    Settings,
    Dog,
    ChevronRight,
    SlidersHorizontal,
    Puzzle,
} from 'lucide-react'
import PreferencesDialog from './PreferencesDialog'

const menuData: Record<string, string[]> = {
    File: ['New...', 'Create', 'Open...', 'Open as Layers...', 'Open Location...', 'Save', 'Save As...', 'Export As...', 'Print...', 'Close View', 'Close All', 'Quit'],
    Edit: ['Undo', 'Redo', 'Fade...', 'Cut', 'Copy', 'Copy Visible', 'Paste', 'Paste Into', 'Paste as', 'Buffer', 'Clear', 'Fill with FG Color', 'Fill with BG Color', 'Fill with Pattern'],
    Select: ['All', 'None', 'Invert', 'Float', 'By Color', 'From Path', 'Editor', 'Feather...', 'Sharpen', 'Shrink...', 'Grow...', 'Border...', 'Distort...', 'Toggle Quick Mask'],
    View: ['New View', 'Display Filters...', 'Zoom', 'Shrink Wrap', 'Fullscreen', 'Navigation Window', 'Display Navigation Guide', 'Snap to Grid', 'Snap to Guides', 'Snap to Canvas Edges', 'Snap to Active Path', 'Padding Color', 'Show Menubar', 'Show Rulers', 'Show Scrollbars', 'Show Statusbar'],
    Image: ['Duplicate', 'Mode', 'Transform', 'Canvas Size...', 'Fit Canvas to Layers', 'Fit Canvas to Selection', 'Print Size...', 'Scale Image...', 'Crop to Selection', 'Autocrop Image', 'Zealous Crop', 'Merge Visible Layers...', 'Flatten Image', 'Align Visible Layers...', 'Guides', 'Grid', 'Properties', 'Metadata'],
    Layer: ['New Layer...', 'New from Visible', 'Duplicate Layer', 'Anchor Layer', 'Merge Down', 'Delete Layer', 'Text to Path', 'Discard Text Information', 'Stack', 'Mask', 'Transparency', 'Transform', 'Layer Boundary Size...', 'Layer to Image Size', 'Scale Layer...', 'Crop to Selection'],
    Colors: ['Color Balance...', 'Color Temperature...', 'Hue-Chroma...', 'Hue-Saturation...', 'Saturation...', 'Exposure...', 'Shadows-Highlights...', 'Brightness-Contrast...', 'Levels...', 'Curves...', 'Invert', 'Linear Invert', 'Value Invert', 'Auto', 'Components', 'Desaturate', 'Map', 'Tone Mapping', 'Info'],
    Tools: ['Selection Tools', 'Paint Tools', 'Transform Tools', 'Paths', 'Color Picker', 'Measure', 'Text', 'GeGL Operation...', 'Toolbox', 'Default Colors', 'Swap Colors'],
    Filters: ['Repeat Last', 'Re-Show Last', 'Reset All Filters', 'Blur', 'Enhance', 'Distorts', 'Light and Shadow', 'Noise', 'Edge-Detect', 'Generic', 'Combine', 'Artistic', 'Decor', 'Map', 'Render', 'Web', 'Animation'],
    'Python-Fu': ['Console', 'Selection', 'Sketch', 'Sphere'],
    Windows: ['Recently Closed Docks', 'Dockable Dialogs', 'Toolbox', 'Hide Docks', 'Single-Window Mode'],
    Help: ['Help', 'Context Help', 'Tip of the Day', 'About', 'Action Search', 'SHRIMP Online', 'User Manual'],
}

export default function Header() {
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [autosave, setAutosave] = useState(true)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [showPreferences, setShowPreferences] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const settingsRef = useRef<HTMLDivElement>(null)

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

    return (
        <>
            <header className="header">
                <div className="header-left">
                    <div className="header-brand">
                        <Dog className="brand-icon" size={16} />
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
                                        {menuData[item].map((option, idx) => (
                                            <div key={idx} className="header-menu-dropdown-item">
                                                {option}
                                                {['New...', 'Open...', 'Save', 'Undo', 'Cut', 'Copy', 'Paste'].includes(
                                                    option
                                                ) && <span className="shortcut">{getShortcut(option)}</span>}
                                                {['Open as Layers...', 'Mode', 'Transform', 'Blur', 'Enhance'].includes(
                                                    option
                                                ) && <ChevronRight size={12} className="submenu-arrow" />}
                                            </div>
                                        ))}
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

                    <div className="header-icon-btn">
                        <Save size={16} />
                    </div>
                    <div className="header-icon-btn">
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
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {showPreferences && <PreferencesDialog onClose={() => setShowPreferences(false)} />}
        </>
    )
}

function getShortcut(option: string): string {
    switch (option) {
        case 'New...':
            return '⌘N'
        case 'Open...':
            return '⌘O'
        case 'Save':
            return '⌘S'
        case 'Undo':
            return '⌘Z'
        case 'Cut':
            return '⌘X'
        case 'Copy':
            return '⌘C'
        case 'Paste':
            return '⌘V'
        default:
            return ''
    }
}

