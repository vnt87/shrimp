import {
    ChevronDown,
    Search,
    Save,
    Upload,
    Settings,
    Dog,
} from 'lucide-react'

export default function Header() {
    const menuItems = [
        'File', 'Edit', 'Select', 'View', 'Image',
        'Layer', 'Colors', 'Tools', 'Filters', 'Python-Fu',
        'Windows', 'Help',
    ]

    return (
        <header className="header">
            <div className="header-left">
                <div className="header-brand">
                    <Dog className="brand-icon" size={16} />
                    <span className="brand-text">The GIMP 2020</span>
                    <ChevronDown className="brand-caret" size={16} />
                </div>
                <nav className="header-menu">
                    {menuItems.map((item) => (
                        <div key={item} className="header-menu-item">
                            {item}
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

                <div className="header-toggle">
                    <span className="header-toggle-label">Autosave</span>
                    <div className="toggle on" />
                </div>

                <div className="header-icon-btn">
                    <Save size={16} />
                </div>
                <div className="header-icon-btn">
                    <Upload size={16} />
                </div>

                <div className="header-divider" />

                <div className="header-settings">
                    <Settings size={16} />
                    <ChevronDown size={16} />
                </div>
            </div>
        </header>
    )
}
