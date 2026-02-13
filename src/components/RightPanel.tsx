import { useState, useCallback, useRef, useEffect } from 'react'
import BrushesPanel from './BrushesPanel'
import LayersPanel from './LayersPanel'
import HistogramPanel from './HistogramPanel'

const MIN_PANEL_H = 80

export default function RightPanel() {
    const containerRef = useRef<HTMLDivElement>(null)
    // Store ratios instead of absolute px so panels adapt on resize
    const [ratios, setRatios] = useState([0.3, 0.5, 0.2]) // brushes, layers, histogram
    const dragging = useRef<{ idx: number; startY: number; startRatios: number[] } | null>(null)

    const getContainerH = useCallback(() => {
        return containerRef.current?.clientHeight ?? 700
    }, [])

    const startDrag = useCallback(
        (idx: number) => (e: React.MouseEvent) => {
            e.preventDefault()
            dragging.current = { idx, startY: e.clientY, startRatios: [...ratios] }

            const onMove = (ev: MouseEvent) => {
                if (!dragging.current) return
                const totalH = getContainerH()
                const dy = ev.clientY - dragging.current.startY
                const deltaRatio = dy / totalH

                const newRatios = [...dragging.current.startRatios]
                const a = newRatios[idx]
                const b = newRatios[idx + 1]

                const minRatio = MIN_PANEL_H / totalH
                let newA = a + deltaRatio
                let newB = b - deltaRatio

                // Clamp
                if (newA < minRatio) {
                    newA = minRatio
                    newB = a + b - minRatio
                }
                if (newB < minRatio) {
                    newB = minRatio
                    newA = a + b - minRatio
                }

                newRatios[idx] = newA
                newRatios[idx + 1] = newB
                setRatios(newRatios)
            }

            const onUp = () => {
                dragging.current = null
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }

            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
        },
        [ratios, getContainerH]
    )

    // Compute pixel heights from ratios
    const [heights, setHeights] = useState([300, 400, 160])
    useEffect(() => {
        const update = () => {
            const totalH = getContainerH()
            setHeights(ratios.map((r) => Math.round(r * totalH)))
        }
        update()
        const ro = new ResizeObserver(update)
        if (containerRef.current) ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [ratios, getContainerH])

    return (
        <div className="right-panel" ref={containerRef}>
            <div style={{ height: heights[0], display: 'flex', flexDirection: 'column' }}>
                <BrushesPanel />
            </div>
            <div
                className="panel-resize-handle"
                onMouseDown={startDrag(0)}
            />
            <div style={{ height: heights[1], display: 'flex', flexDirection: 'column' }}>
                <LayersPanel />
            </div>
            <div
                className="panel-resize-handle"
                onMouseDown={startDrag(1)}
            />
            <div style={{ height: heights[2], display: 'flex', flexDirection: 'column' }}>
                <HistogramPanel />
            </div>
        </div>
    )
}
