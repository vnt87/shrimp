import BrushesPanel from './BrushesPanel'
import LayersPanel from './LayersPanel'
import HistogramPanel from './HistogramPanel'

export default function RightPanel() {
    return (
        <div className="right-panel">
            <BrushesPanel />
            <LayersPanel />
            <HistogramPanel />
        </div>
    )
}
