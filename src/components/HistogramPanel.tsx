import { useLayoutEffect, useRef, useState } from 'react'
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
        // Logarithmic scale is much better for visualizing histograms with dominant peaks
        // y = log(1+count) / log(1+max)
        const normalized = Math.log10(1 + data[i]) / Math.log10(1 + max)
        const y = height - (normalized * height * 0.95) // Leave 5% padding at top
        d += ` L ${x} ${y}`
    }

    d += ` L ${width} ${height} Z`
    return d
}

export default function HistogramPanel() {
    const { cursorInfo, histogramData, activeChannels } = useEditor()
    const [activeTab, setActiveTab] = useState<'histogram' | 'navigator' | 'info'>('histogram')
    const histogramContainerRef = useRef<HTMLDivElement | null>(null)
    const [histogramSize, setHistogramSize] = useState({ width: 330, height: 132 })
    const GRID_SPACING = 10
    const chartW = 330
    const chartH = 132

    useLayoutEffect(() => {
        const container = histogramContainerRef.current
        if (!container) return

        const updateSize = () => {
            setHistogramSize({
                width: Math.max(0, Math.floor(container.clientWidth)),
                height: Math.max(0, Math.floor(container.clientHeight))
            })
        }

        updateSize()
        const observer = new ResizeObserver(updateSize)
        observer.observe(container)

        return () => observer.disconnect()
    }, [])

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
                    <div
                        ref={histogramContainerRef}
                        className="histogram-container"
                        style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#4a4a4a' }}
                    >
                        {/* Grid */}
                        <div className="histogram-grid">
                            {Array.from({ length: Math.floor(histogramSize.width / GRID_SPACING) + 1 }).map((_, i) => (
                                <div
                                    key={`v${i}`}
                                    className="histogram-grid-line-v"
                                    style={{ left: i * GRID_SPACING, background: 'rgba(255, 255, 255, 0.1)' }}
                                />
                            ))}
                            {Array.from({ length: Math.floor(histogramSize.height / GRID_SPACING) + 1 }).map((_, i) => (
                                <div
                                    key={`h${i}`}
                                    className="histogram-grid-line-h"
                                    style={{ top: i * GRID_SPACING, background: 'rgba(255, 255, 255, 0.1)' }}
                                />
                            ))}
                        </div>

                        {/* Charts */}
                        <div className="histogram-chart" style={{ backgroundColor: '#000000', mixBlendMode: 'lighten' }}>
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                                {histogramData && activeChannels.includes('r') && (
                                    <path
                                        d={generateHistogramPath(histogramData.r, chartW, chartH, maxValue)}
                                        fill="rgba(255, 0, 0, 0.4)"
                                        stroke="rgba(255, 100, 100, 0.8)"
                                        strokeWidth="1"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {histogramData && activeChannels.includes('g') && (
                                    <path
                                        d={generateHistogramPath(histogramData.g, chartW, chartH, maxValue)}
                                        fill="rgba(0, 255, 0, 0.4)"
                                        stroke="rgba(100, 255, 100, 0.8)"
                                        strokeWidth="1"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {histogramData && activeChannels.includes('b') && (
                                    <path
                                        d={generateHistogramPath(histogramData.b, chartW, chartH, maxValue)}
                                        fill="rgba(0, 0, 255, 0.4)"
                                        stroke="rgba(100, 100, 255, 0.8)"
                                        strokeWidth="1"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
                                {histogramData && activeChannels.includes('lum') && (
                                    <path
                                        d={generateHistogramPath(histogramData.lum, chartW, chartH, maxValue)}
                                        fill="rgba(255, 255, 255, 0.2)"
                                        stroke="rgba(255, 255, 255, 0.6)"
                                        strokeWidth="1"
                                        style={{ mixBlendMode: 'screen' }}
                                    />
                                )}
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
