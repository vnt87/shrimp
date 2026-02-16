import { FoldVertical, UnfoldVertical, X } from 'lucide-react'
import { useLayout, LayoutState } from './LayoutContext'

interface PanelMenuProps {
    panelId: keyof LayoutState['panels']
}

export default function PanelMenu({ panelId }: PanelMenuProps) {
    const { panels, togglePanelMinimized, togglePanelVisibility } = useLayout()
    const isMinimized = panels[panelId].minimized
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div
                className="panel-header-action"
                onClick={() => togglePanelMinimized(panelId)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 3,
                    color: 'var(--text-secondary)'
                }}
            >
                {isMinimized ? <UnfoldVertical size={13} /> : <FoldVertical size={13} />}
            </div>
            <div
                className="panel-header-action"
                onClick={() => togglePanelVisibility(panelId)}
                title="Close"
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 3,
                    color: 'var(--text-secondary)'
                }}
            >
                <X size={13} />
            </div>
        </div>
    )
}
