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

    return (
        <footer className="status-bar">
            <div className="status-group" style={{ marginLeft: 4 }}>
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
            <div className="status-group" style={{ marginLeft: 16 }}>
                <span className="status-text" style={{ fontWeight: 500 }}>
                    {activeLayer?.name || 'No layer'}
                </span>
                {activeLayer?.x !== undefined && activeLayer?.y !== undefined && (
                    <>
                        <span className="status-text" style={{ marginLeft: 12 }}>x:</span>
                        <span
                            className="status-text"
                            style={{
                                width: 40,
                                display: 'inline-block',
                                textAlign: 'left',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {activeLayer.x}
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
                            {activeLayer.y}
                        </span>
                    </>
                )}
            </div>
            <div className="status-spacer" />
            <div className="status-group" style={{ marginRight: 8 }}>
                <span className="status-text">{canvasSize.width} x {canvasSize.height}</span>
            </div>
        </footer>
    )
}
