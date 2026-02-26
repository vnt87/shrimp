import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface PanelState {
    visible: boolean
    minimized: boolean
}

export interface LayoutState {
    panels: {
        brushes: PanelState
        layers: PanelState
        histogram: PanelState
    }
}

interface LayoutContextType {
    panels: LayoutState['panels']
    isRightPanelHidden: boolean
    togglePanelVisibility: (panelId: keyof LayoutState['panels']) => void
    setPanelMinimized: (panelId: keyof LayoutState['panels'], minimized: boolean) => void
    togglePanelMinimized: (panelId: keyof LayoutState['panels']) => void
    openPanel: (panelId: keyof LayoutState['panels']) => void // Ensure it's visible
    toggleRightPanelHidden: () => void
    setRightPanelHidden: (hidden: boolean) => void
}

const defaultPanelState: PanelState = { visible: true, minimized: false }

const defaultState: LayoutState = {
    panels: {
        brushes: { ...defaultPanelState },
        layers: { ...defaultPanelState },
        histogram: { ...defaultPanelState },
    },
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [panels, setPanels] = useState<LayoutState['panels']>(defaultState.panels)
    const [isRightPanelHidden, setRightPanelHidden] = useState(false)

    const togglePanelVisibility = useCallback((panelId: keyof LayoutState['panels']) => {
        setPanels((prev) => ({
            ...prev,
            [panelId]: { ...prev[panelId], visible: !prev[panelId].visible },
        }))
    }, [])

    const openPanel = useCallback((panelId: keyof LayoutState['panels']) => {
        setPanels((prev) => ({
            ...prev,
            [panelId]: { ...prev[panelId], visible: true },
        }))
    }, [])

    const setPanelMinimized = useCallback((panelId: keyof LayoutState['panels'], minimized: boolean) => {
        setPanels((prev) => ({
            ...prev,
            [panelId]: { ...prev[panelId], minimized },
        }))
    }, [])

    const togglePanelMinimized = useCallback((panelId: keyof LayoutState['panels']) => {
        setPanels((prev) => ({
            ...prev,
            [panelId]: { ...prev[panelId], minimized: !prev[panelId].minimized },
        }))
    }, [])

    const toggleRightPanelHidden = useCallback(() => {
        setRightPanelHidden((prev) => !prev)
    }, [])

    const value = {
        panels,
        isRightPanelHidden,
        togglePanelVisibility,
        setPanelMinimized,
        togglePanelMinimized,
        openPanel,
        toggleRightPanelHidden,
        setRightPanelHidden,
    }

    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
    const context = useContext(LayoutContext)
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider')
    }
    return context
}
