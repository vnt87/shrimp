import { useState, useCallback, useRef } from 'react'
import { useLayout } from './LayoutContext'
import BrushesPanel from './BrushesPanel'
import LayersPanel from './LayersPanel'
import HistogramPanel from './HistogramPanel'

const MIN_PANEL_H = 80

export default function RightPanel() {
    const containerRef = useRef<HTMLDivElement>(null)
    const { panels, isRightPanelHidden } = useLayout()

    // We still store ratios for the *expanded* panels relative to each other.
    // However, we need to handle the case where some are hidden or minimized.
    // Let's keep a local state for "intrinsic relative heights" of the 3 panels.
    // If a panel is hidden/minimized, its weight is ignored in the flex calculation,
    // but we preserve the ratio for when it returns.
    const [panelWeights, setPanelWeights] = useState({ brushes: 0.3, layers: 0.5, histogram: 0.2 })

    const dragging = useRef<{ idx: number; startY: number; startWeights: typeof panelWeights; visibleKeys: string[] } | null>(null)

    // Helper to get visible non-minimized panels in order
    const getResizablePanels = useCallback(() => {
        const keys: (keyof typeof panels)[] = ['brushes', 'layers', 'histogram']
        return keys.filter(k => panels[k].visible && !panels[k].minimized)
    }, [panels])

    const startDrag = useCallback(
        (resizeIndex: number) => (e: React.MouseEvent) => {
            e.preventDefault()
            const resizablePanels = getResizablePanels()
            // resizeIndex is the index in the *rendered resizable panels list*
            // The handle is after panel[resizeIndex].
            // It affects panel[resizeIndex] vs panel[resizeIndex+1].

            if (resizeIndex >= resizablePanels.length - 1) return

            const topKey = resizablePanels[resizeIndex] as keyof typeof panelWeights
            const bottomKey = resizablePanels[resizeIndex + 1] as keyof typeof panelWeights

            dragging.current = {
                idx: resizeIndex,
                startY: e.clientY,
                startWeights: { ...panelWeights },
                visibleKeys: resizablePanels
            }

            const onMove = (ev: MouseEvent) => {
                if (!dragging.current) return
                if (!containerRef.current) return

                const { startY, startWeights } = dragging.current
                const dy = ev.clientY - startY

                // We need to convert dy to "weight delta".
                // Total height of *resizable* area:
                const containerH = containerRef.current.clientHeight
                const minimizedCount = Object.values(panels).filter(p => p.visible && p.minimized).length
                const headerH = 32 // Approx header height
                const availableH = containerH - (minimizedCount * headerH)

                if (availableH <= 0) return

                const deltaWeight = dy / availableH

                // We are trading weight between topKey and bottomKey
                // BUT, keep in mind panelWeights might not sum to 1 if some are hidden.
                // It's easier if we just modify the raw weights.

                let newTopW = startWeights[topKey] + deltaWeight
                let newBottomW = startWeights[bottomKey] - deltaWeight

                // Clamp
                const minWeight = 0.05 // Min 5%
                if (newTopW < minWeight) {
                    const diff = minWeight - newTopW
                    newTopW = minWeight
                    newBottomW -= diff
                }
                if (newBottomW < minWeight) {
                    const diff = minWeight - newBottomW
                    newBottomW = minWeight
                    newTopW -= diff
                }

                setPanelWeights(prev => ({
                    ...prev,
                    [topKey]: newTopW,
                    [bottomKey]: newBottomW
                }))
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
        [getResizablePanels, panelWeights, panels]
    )

    // Logic to determine which panels get a resize handle
    // Only panels that are visible AND not minimized get resize handles (except the last one).
    // Actually, we render handles *between* resizable nodes.

    const visibleNonMinimized = getResizablePanels()

    return (
        <div className="right-panel" aria-hidden={isRightPanelHidden} ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/*  Correct Loop Implementation  */}
            {(() => {
                const nodes: React.ReactNode[] = []
                const items: { id: keyof typeof panels, component: any }[] = [
                    { id: 'brushes', component: BrushesPanel },
                    { id: 'layers', component: LayersPanel },
                    { id: 'histogram', component: HistogramPanel }
                ]

                // Calculate total weight of visible expanded panels to normalize
                const visibleExpanded = items.filter(
                    item => panels[item.id].visible && !panels[item.id].minimized
                )
                const totalWeight = visibleExpanded.reduce(
                    (sum, item) => sum + panelWeights[item.id as keyof typeof panelWeights],
                    0
                )

                // Avoid division by zero
                const scaleFactor = totalWeight > 0 ? (1 / totalWeight) : 1

                let resizableIdx = 0

                items.forEach((item) => {
                    const state = panels[item.id]
                    if (!state.visible) return

                    if (state.minimized) {
                        nodes.push(
                            <div key={item.id} style={{ height: 33, overflow: 'hidden', flexShrink: 0, borderBottom: '1px solid var(--border-main)' }}>
                                <item.component />
                            </div>
                        )
                    } else {
                        const isLastResizable = visibleNonMinimized[visibleNonMinimized.length - 1] === item.id

                        // We scale the weight so they sum to 1 (or close to it) 
                        // forcing the flex container to fill completely.
                        const weight = panelWeights[item.id as keyof typeof panelWeights] * scaleFactor

                        nodes.push(
                            <div key={item.id} style={{ flexGrow: weight, flexBasis: 0, minHeight: MIN_PANEL_H, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <item.component />
                            </div>
                        )

                        if (!isLastResizable) {
                            nodes.push(
                                <div
                                    key={`handle-${item.id}`}
                                    className="panel-resize-handle"
                                    onMouseDown={startDrag(resizableIdx)}
                                    style={{ cursor: 'row-resize', height: 4, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-main)', flexShrink: 0 }}
                                />
                            )
                            resizableIdx++
                        }
                    }
                })

                return nodes
            })()}
        </div>
    )
}
