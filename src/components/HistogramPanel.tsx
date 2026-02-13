import { MoreVertical, AlertTriangle } from 'lucide-react'

// Generate stacked area chart paths
function generateAreaPath(
    width: number,
    height: number,
    baseY: number,
    amplitude: number,
    seed: number
): string {
    const points: number[] = []
    const steps = 20

    for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width
        const noise =
            Math.sin(i * 0.8 + seed) * amplitude * 0.4 +
            Math.sin(i * 1.5 + seed * 2) * amplitude * 0.3 +
            Math.cos(i * 0.3 + seed * 3) * amplitude * 0.2
        points.push(x)
        points.push(Math.max(0, Math.min(height, baseY - noise)))
    }

    let d = `M 0 ${height}`
    for (let i = 0; i < points.length; i += 2) {
        d += ` L ${points[i]} ${points[i + 1]}`
    }
    d += ` L ${width} ${height} Z`
    return d
}

export default function HistogramPanel() {
    const chartW = 330
    const chartH = 132

    const areas = [
        { baseY: 100, amplitude: 30, color: 'rgba(160, 80, 200, 0.3)', seed: 1 },
        { baseY: 85, amplitude: 25, color: 'rgba(200, 80, 80, 0.35)', seed: 2.5 },
        { baseY: 65, amplitude: 20, color: 'rgba(200, 160, 60, 0.4)', seed: 4 },
        { baseY: 50, amplitude: 20, color: 'rgba(100, 180, 120, 0.4)', seed: 5.5 },
        { baseY: 35, amplitude: 18, color: 'rgba(80, 120, 200, 0.5)', seed: 7 },
    ]

    return (
        <div className="dialogue" style={{ flex: 1, overflow: 'hidden' }}>
            {/* Header tabs */}
            <div className="dialogue-header">
                <div className="dialogue-tabs">
                    <div className="dialogue-tab inactive">Histogram</div>
                    <div className="dialogue-tab inactive">Navigator</div>
                    <div className="dialogue-tab active">Info</div>
                </div>
                <div className="dialogue-more">
                    <MoreVertical size={16} />
                </div>
            </div>

            {/* Chart area */}
            <div className="histogram-container" style={{ flex: 1, position: 'relative' }}>
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

                {/* Stacked area chart */}
                <div className="histogram-chart">
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                        {areas.map((area, i) => (
                            <path
                                key={i}
                                d={generateAreaPath(
                                    chartW,
                                    chartH,
                                    area.baseY,
                                    area.amplitude,
                                    area.seed
                                )}
                                fill={area.color}
                            />
                        ))}
                    </svg>
                </div>

                {/* Warning icon */}
                <div className="histogram-warning">
                    <AlertTriangle size={24} />
                </div>
            </div>

            <div className="dialogue-handle" style={{ marginBottom: 1 }} />
        </div>
    )
}
