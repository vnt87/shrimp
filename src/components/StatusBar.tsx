import { useEditor, Layer } from './EditorContext'

export default function StatusBar({
    cursorPos,
}: {
    cursorPos: { x: number; y: number } | null
}) {
    const { activeLayerId, layers } = useEditor()

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
                <span className="status-text">Cursor Position</span>
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
                <span className="status-text">Width:</span>
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
                <span className="status-text" style={{ marginLeft: 26 }}>Height:</span>
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
                <span className="status-text">Position Change x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Starting Position x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Angle x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Color Profile: GNU RGB</span>
            </div>
            <div className="status-spacer" />
            <div className="status-group" style={{ marginRight: 40 }}>
                <span className="status-text">8 bits per channel</span>
            </div>
            <div className="status-group" style={{ marginRight: 0 }}>
                <span className="status-text">1920 x 1080 72 dpi</span>
            </div>
        </footer>
    )
}
