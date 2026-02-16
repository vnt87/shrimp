import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useEditor } from './EditorContext'
import InfoPanel from './InfoPanel'
import NavigatorPanel from './NavigatorPanel'
import PanelMenu from './PanelMenu'

// Generate SVG path from histogram data
function generateHistogramPath(
    data: number[],
    width: number,
    height: number,
    maxValue: number
): string {
    if (!data || data.length === 0) return ''

    // Normalization factor (prevent division by zero)
    const max = maxValue || 1

    let d = `M 0 ${height}`

    const step = width / (data.length - 1)

    for (let i = 0; i < data.length; i++) {
        const x = i * step
        // Logarithmic scale often looks better for histograms, but linear is standard
        // Let's use linear for now.
        const normalized = data[i] / max
        const y = height - (normalized * height * 0.95) // Leave 5% padding at top
        d += ` L ${x} ${y}`
    }

    d += ` L ${width} ${height} Z`
    return d
}

export default function HistogramPanel() {
    const { cursorInfo, histogramData, activeChannels } = useEditor()
    const [activeTab, setActiveTab] = useState<'histogram' | 'navigator' | 'info'>('histogram')
    const chartW = 330
    const chartH = 132

    // Calculate max value for normalization
    const maxValue = histogramData
        ? Math.max(
            ...histogramData.r,
            ...histogramData.g,
            ...histogramData.b
        )
        : 1

    return (
        <div className="dialogue" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header tabs */}
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <div
                        className={`dialogue-tab ${activeTab === 'histogram' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('histogram')}
                    >
                        Histogram
                    </div>
                    <div
                        className={`dialogue-tab ${activeTab === 'navigator' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('navigator')}
                    >
                        Navigator
                    </div>
                    <div
                        className={`dialogue-tab ${activeTab === 'info' ? 'active' : 'inactive'}`}
                        onClick={() => setActiveTab('info')}
                    >
                        Info
                    </div>
                </div>
                <PanelMenu panelId="histogram" />
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {activeTab === 'histogram' && (
                    <div className="histogram-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {/* Grid */}
                        <div className="histogram-grid">
                            {Array.from({ length: 34 }).map((_, i) => (
                                <div
                                    key={`v${i}`}
                                    className="histogram-grid-line-v"
                                    style={{ left: i * 10 }}
                                />
                            ))}
                            {Array.from({ length: 14 }).map((_, i) => (
                                <div
                                    key={`h${i}`}
                                    className="histogram-grid-line-h"
                                    style={{ top: i * 10 }}
                                />
                            ))}
                        </div>

                        {/* Charts */}
                        <div className="histogram-chart" style={{ mixBlendMode: 'screen' }}>
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                                {histogramData && activeChannels.includes('r') && (
                                    <path
                                        d={generateHistogramPath(histogramData.r, chartW, chartH, maxValue)}
                                        fill="rgba(255, 0, 0, 0.5)"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {histogramData && activeChannels.includes('g') && (
                                    <path
                                        d={generateHistogramPath(histogramData.g, chartW, chartH, maxValue)}
                                        fill="rgba(0, 255, 0, 0.5)"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {histogramData && activeChannels.includes('b') && (
                                    <path
                                        d={generateHistogramPath(histogramData.b, chartW, chartH, maxValue)}
                                        fill="rgba(0, 0, 255, 0.5)"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {/* Luminance (active by default if RGB are all active or inactive? Logic can vary) */}
                                {/* For now let's show Luminance if it's explicitly selected or maybe as a background? */}
                                {/* Typically Apps show RGB + Gray using logic. Let's just stick to RGB for now based on activeChannels */}
                            </svg>
                        </div>

                        {/* Warning icon if no data */}
                        {!histogramData && (
                            <div className="histogram-warning">
                                <AlertTriangle size={24} color="#aaa" />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'navigator' && (
                    <NavigatorPanel />
                )}

                {activeTab === 'info' && (
                    <InfoPanel
                        cursorPos={{ x: cursorInfo.x, y: cursorInfo.y }}
                        colorUnderCursor={cursorInfo.color}
                    />
                )}
            </div>

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
