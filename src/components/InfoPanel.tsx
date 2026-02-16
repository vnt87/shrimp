import { useEditor } from './EditorContext'
import { MousePointer2, Droplet } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

interface InfoPanelProps {
    cursorPos: { x: number; y: number } | null
    colorUnderCursor: string | null
}

export default function InfoPanel({ cursorPos, colorUnderCursor }: InfoPanelProps) {
    const { canvasSize } = useEditor()
    const { t } = useLanguage()

    // Helper to convert hex to RGB
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null
    }

    const rgb = colorUnderCursor ? hexToRgb(colorUnderCursor) : null

    return (
        <div className="info-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
            {/* Cursor Position */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MousePointer2 size={14} />
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 60 }}>
                        <span style={{ fontWeight: 600, marginRight: 4 }}>{t('info.x')}</span>
                        {cursorPos ? Math.round(cursorPos.x) : '-'}
                    </div>
                    <div style={{ width: 60 }}>
                        <span style={{ fontWeight: 600, marginRight: 4 }}>{t('info.y')}</span>
                        {cursorPos ? Math.round(cursorPos.y) : '-'}
                    </div>
                </div>
            </div>

            {/* Canvas Size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 22 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 60 }}>
                        <span style={{ fontWeight: 600, marginRight: 4 }}>{t('info.w')}</span>
                        {canvasSize.width}
                    </div>
                    <div style={{ width: 60 }}>
                        <span style={{ fontWeight: 600, marginRight: 4 }}>{t('info.h')}</span>
                        {canvasSize.height}
                    </div>
                </div>
            </div>

            <div className="tool-options-divider" />

            {/* Color Info */}
            <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                <Droplet size={14} style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                background: colorUnderCursor || 'transparent',
                                border: '1px solid var(--border-main)',
                                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                            }}
                        />
                        <div style={{ fontFamily: 'monospace' }}>
                            {colorUnderCursor || '#------'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontFamily: 'monospace', opacity: 0.8 }}>
                        <span>{t('info.r')}{rgb ? rgb.r.toString().padStart(3) : '---'}</span>
                        <span>{t('info.g')}{rgb ? rgb.g.toString().padStart(3) : '---'}</span>
                        <span>{t('info.b')}{rgb ? rgb.b.toString().padStart(3) : '---'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
