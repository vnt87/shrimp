import { useEditor, Layer } from './EditorContext'
import { useLanguage } from '../i18n/LanguageContext'

export default function StatusBar({
    cursorPos,
}: {
    cursorPos: { x: number; y: number } | null
}) {
    const { activeLayerId, layers, canvasSize } = useEditor()
    const { t } = useLanguage()

    const findLayerById = (layers: Layer[], id: string): Layer | null => {
        for (const layer of layers) {
            if (layer.id === id) return layer
            if (layer.children) {
                const found = findLayerById(layer.children, id)
                if (found) return found
            }
        }
        return null
    }

    const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : null
    const width = activeLayer?.data ? activeLayer.data.width : '---'
    const height = activeLayer?.data ? activeLayer.data.height : '---'

    return (
        <footer className="status-bar">
            <div className="status-group">
                <span className="status-text">{t('statusbar.cursor_position')}</span>
                <span className="status-text" style={{ marginLeft: 8 }}>x:</span>
                <span
                    className="status-text"
                    style={{
                        width: 40,
                        display: 'inline-block',
                        textAlign: 'left',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {cursorPos ? cursorPos.x : '---'}
                </span>
                <span className="status-text" style={{ marginLeft: 8 }}>y:</span>
                <span
                    className="status-text"
                    style={{
                        width: 40,
                        display: 'inline-block',
                        textAlign: 'left',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {cursorPos ? cursorPos.y : '---'}
                </span>
            </div>
            <div className="status-group">
                <span className="status-text">{t('statusbar.width')}:</span>
                <span
                    className="status-text"
                    style={{
                        width: 60,
                        display: 'inline-block',
                        textAlign: 'left',
                        fontVariantNumeric: 'tabular-nums',
                        marginLeft: 8,
                    }}
                >
                    {typeof width === 'number' ? `${width}px` : width}
                </span>
                <span className="status-text" style={{ marginLeft: 26 }}>{t('statusbar.height')}:</span>
                <span
                    className="status-text"
                    style={{
                        width: 60,
                        display: 'inline-block',
                        textAlign: 'left',
                        fontVariantNumeric: 'tabular-nums',
                        marginLeft: 8,
                    }}
                >
                    {typeof height === 'number' ? `${height}px` : height}
                </span>
            </div>
            <div className="status-group">
                <span className="status-text">{t('statusbar.position_change')} x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">{t('statusbar.starting_position')} x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">{t('statusbar.angle')} x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">{t('statusbar.color_profile')}: GNU RGB</span>
            </div>
            <div className="status-spacer" />
            <div className="status-group" style={{ marginRight: 40 }}>
                <span className="status-text">{t('statusbar.bits_per_channel')}</span>
            </div>
            <div className="status-group" style={{ marginRight: 0 }}>
                <span className="status-text">{canvasSize.width} x {canvasSize.height} 72 dpi</span>
            </div>
        </footer>
    )
}
