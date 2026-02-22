import { useEditor, Layer } from './EditorContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useHistoryMemory, getMemoryPressure, getMemoryPressureColor } from '../hooks/useHistoryMemory'

// Helper to get memory limit from preferences
const getMemoryLimitMB = (): number => {
    try {
        const stored = localStorage.getItem('shrimp_preferences')
        if (stored) {
            const prefs = JSON.parse(stored)
            if (prefs.historyMemoryMB && typeof prefs.historyMemoryMB === 'number') {
                return Math.max(100, prefs.historyMemoryMB)
            }
        }
    } catch {
        // Ignore errors
    }
    return 500 // Default
}

export default function StatusBar({
    cursorPos,
}: {
    cursorPos: { x: number; y: number } | null
}) {
    const { activeLayerId, layers, canvasSize, documents, activeDocumentId } = useEditor()
    const { t } = useLanguage()
    
    // Monitor memory usage with limit from preferences
    const memoryLimitMB = getMemoryLimitMB()
    const memoryStats = useHistoryMemory(documents, activeDocumentId, memoryLimitMB)
    const memoryPressure = getMemoryPressure(memoryStats.totalMB, memoryStats.maxMB)
    const memoryColor = getMemoryPressureColor(memoryPressure)

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
                {/* Memory indicator */}
                <span 
                    className="status-text" 
                    style={{ color: memoryColor, cursor: 'default' }}
                    title={`History memory: ${memoryStats.totalMB.toFixed(1)} MB\nHistory entries: ${memoryStats.entryCount}\nMax limit: ${memoryStats.maxMB} MB`}
                >
                    💾 {memoryStats.totalMB.toFixed(0)} MB
                </span>
                {memoryPressure === 'high' || memoryPressure === 'critical' ? (
                    <span className="status-text" style={{ color: memoryColor, marginLeft: 4 }} title="Memory pressure is high. Consider reducing undo levels.">
                        ⚠️
                    </span>
                ) : null}
                <span className="status-separator" style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                <span className="status-text">{canvasSize.width} x {canvasSize.height}</span>
            </div>
        </footer>
    )
}
