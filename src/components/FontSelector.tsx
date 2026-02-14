import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { TOP_GOOGLE_FONTS, getGoogleFontUrl } from '../utils/googleFonts';

interface FontSelectorProps {
    value: string;
    onChange: (font: string) => void;
}

const BUILT_IN_FONTS = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
    'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact'
];

export default function FontSelector({ value, onChange }: FontSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const allFonts = [
        ...BUILT_IN_FONTS.map(f => ({ family: f, category: 'System' })),
        ...TOP_GOOGLE_FONTS
    ];

    const filteredFonts = allFonts.filter(f =>
        f.family.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load preview fonts on demand
    const FontPreviewItem = ({ family }: { family: string }) => {
        const isGoogleFont = !BUILT_IN_FONTS.includes(family);
        const [isLoaded, setIsLoaded] = useState(!isGoogleFont);

        useEffect(() => {
            if (isGoogleFont && isOpen) {
                const linkId = `font-preview-${family.toLowerCase().replace(/\s+/g, '-')}`;
                if (!document.getElementById(linkId)) {
                    const link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    link.href = getGoogleFontUrl(family, family);
                    document.head.appendChild(link);
                }

                if ('fonts' in document) {
                    (document as any).fonts.load(`12px "${family}"`).then(() => setIsLoaded(true));
                } else {
                    setTimeout(() => setIsLoaded(true), 500);
                }
            }
        }, [family, isOpen, isGoogleFont]);

        return (
            <div
                className={`font-option ${value === family ? 'active' : ''}`}
                onClick={() => {
                    onChange(family);
                    setIsOpen(false);
                }}
                style={{
                    fontFamily: isLoaded ? `"${family}", sans-serif` : 'sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                }}
            >
                <span>{family}</span>
                {value === family && <Check size={14} />}
            </div>
        );
    };

    return (
        <div className="font-selector" ref={dropdownRef} style={{ position: 'relative', width: '180px' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="tool-options-select"
                style={{
                    width: '100%',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    textAlign: 'left',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                <ChevronDown size={12} />
            </button>

            {isOpen && (
                <div
                    className="font-dropdown"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: '240px',
                        maxHeight: '400px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-main)',
                        borderRadius: '4px',
                        marginTop: '4px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={14} color="var(--text-secondary)" />
                        <input
                            autoFocus
                            placeholder="Search fonts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '13px',
                                width: '100%'
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredFonts.map(f => (
                            <FontPreviewItem key={f.family} family={f.family} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
