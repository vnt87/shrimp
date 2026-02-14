import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useHistory } from '../hooks/useHistory'

export interface LayerFilter {
    type: 'blur' | 'brightness' | 'hue-saturation' | 'noise' | 'color-matrix' | 'custom'
    enabled: boolean
    params: Record<string, number>
}

export interface Layer {
    id: string
    name: string
    visible: boolean
    locked: boolean
    opacity: number
    blendMode: string
    data: HTMLCanvasElement | null // Offscreen canvas for layer data (CPU-side)
    filters: LayerFilter[]         // Non-destructive GPU filter stack
    x: number
    y: number
    type: 'layer' | 'group'
    children?: Layer[] // For groups
}

export interface Selection {
    type: 'rect' | 'ellipse' | 'path'
    x: number
    y: number
    width: number
    height: number
    path?: { x: number; y: number }[]
}

interface EditorContextType {
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null

    // Actions
    setCanvasSize: (size: { width: number; height: number }) => void
    addLayer: (name?: string, initialData?: HTMLCanvasElement) => string
    deleteLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void
    setLayerOpacity: (id: string, opacity: number) => void
    updateLayerData: (id: string, canvas: HTMLCanvasElement) => void
    updateLayerPosition: (id: string, x: number, y: number) => void
    addFilter: (layerId: string, filter: LayerFilter) => void
    removeFilter: (layerId: string, filterIndex: number) => void
    setSelection: (selection: Selection | null) => void
    reorderLayers: (startIndex: number, endIndex: number) => void
    // History
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    addToHistory: () => void
    cropCanvas: (x: number, y: number, width: number, height: number) => void
    closeImage: () => void
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

// Define the state we want to track in history
interface EditorState {
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
    // Initial state
    const emptyState: EditorState = {
        layers: [],
        activeLayerId: null,
        canvasSize: { width: 800, height: 600 },
        selection: null
    }

    const {
        state: historyState,
        set: setHistoryState,
        undo,
        redo,
        canUndo,
        canRedo,
        clear: clearHistory
    } = useHistory<EditorState>(emptyState)

    // Derived state for easier usage
    const { layers, activeLayerId, canvasSize, selection } = historyState

    // Helper to commit current state changes to history.
    // Call this BEFORE making a "new" move if you want to snapshot the previous state?
    // Actually, useHistory's `set` PUSHES to history effectively.
    // So simply calling setHistoryState with new data creates a new history point.

    // However, some actions (like dragging) update state frequently but should only create ONE history entry (on drag end).
    // For those, we might need a "draft" state or just use `setHistoryState` only on drag end.
    // BUT our context exposes `setLayers` etc which are used by components directly.
    // We need to wrap those sets.

    // Strategy: 
    // All "setter" functions below will now call `setHistoryState`.
    // This implies EVERY action is an undoable step.
    // For dragging, components should probably manage local state and only commit to context on MouseUp.
    // Let's assume components do that for now (Canvas.tsx does for Move tool).

    const updateState = useCallback((updates: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>)) => {
        setHistoryState(prevFullState => {
            const newPart = typeof updates === 'function' ? updates(prevFullState) : updates
            return {
                ...prevFullState,
                ...newPart
            }
        })
    }, [setHistoryState])

    // Helper to create a new layer
    const createLayer = (name: string, size: { width: number, height: number }, initialData?: HTMLCanvasElement): Layer => {
        const canvas = initialData || document.createElement('canvas')
        if (!initialData) {
            canvas.width = size.width
            canvas.height = size.height
        }
        return {
            id: Math.random().toString(36).substr(2, 9),
            name,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            data: canvas,
            filters: [],
            x: 0,
            y: 0,
            type: 'layer'
        }
    }

    const setCanvasSizeWrapper = useCallback((size: { width: number; height: number }) => {
        updateState((prevState) => {
            const newLayers = prevState.layers.map(layer => {
                if (layer.data) {
                    const newCanvas = document.createElement('canvas')
                    newCanvas.width = size.width
                    newCanvas.height = size.height
                    const ctx = newCanvas.getContext('2d')
                    if (ctx) {
                        ctx.drawImage(layer.data, 0, 0)
                    }
                    return { ...layer, data: newCanvas }
                }
                return layer
            })
            return { canvasSize: size, layers: newLayers }
        })
    }, [updateState])

    const addLayer = useCallback((name: string = 'New Layer', initialData?: HTMLCanvasElement) => {
        let newLayerId = ''
        updateState((prevState) => {
            const newLayer = createLayer(name, prevState.canvasSize, initialData)
            newLayerId = newLayer.id
            return {
                layers: [newLayer, ...prevState.layers],
                activeLayerId: newLayer.id
            }
        })
        return newLayerId
    }, [updateState])

    const updateLayerPosition = useCallback((id: string, x: number, y: number) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l => l.id === id ? { ...l, x, y } : l)
        }))
    }, [updateState])

    const deleteLayer = useCallback((id: string) => {
        updateState(prevState => {
            const newLayers = prevState.layers.filter(l => l.id !== id)
            let newActiveId = prevState.activeLayerId
            if (prevState.activeLayerId === id) {
                newActiveId = newLayers.length > 0 ? newLayers[0].id : null
            }
            return {
                layers: newLayers,
                activeLayerId: newActiveId
            }
        })
    }, [updateState])

    const setActiveLayer = useCallback((id: string) => {
        updateState({ activeLayerId: id })
    }, [updateState])

    const toggleLayerVisibility = useCallback((id: string) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
        }))
    }, [updateState])

    const toggleLayerLock = useCallback((id: string) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l)
        }))
    }, [updateState])

    const setLayerOpacity = useCallback((id: string, opacity: number) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l => l.id === id ? { ...l, opacity } : l)
        }))
    }, [updateState])

    const updateLayerData = useCallback((id: string, canvas: HTMLCanvasElement) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l => {
                if (l.id === id) {
                    return { ...l, data: canvas }
                }
                return l
            })
        }))
    }, [updateState])

    const addFilter = useCallback((layerId: string, filter: LayerFilter) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l =>
                l.id === layerId ? { ...l, filters: [...l.filters, filter] } : l
            )
        }))
    }, [updateState])

    const removeFilter = useCallback((layerId: string, filterIndex: number) => {
        updateState(prevState => ({
            layers: prevState.layers.map(l =>
                l.id === layerId ? { ...l, filters: l.filters.filter((_, i) => i !== filterIndex) } : l
            )
        }))
    }, [updateState])

    const reorderLayers = useCallback((startIndex: number, endIndex: number) => {
        updateState(prevState => {
            const result = Array.from(prevState.layers)
            const [removed] = result.splice(startIndex, 1)
            result.splice(endIndex, 0, removed)
            return { layers: result }
        })
    }, [updateState])

    const cropCanvas = useCallback((x: number, y: number, width: number, height: number) => {
        updateState(prevState => {
            const newLayers = prevState.layers.map(layer => {
                if (!layer.data) return layer
                const newCanvas = document.createElement('canvas')
                newCanvas.width = width
                newCanvas.height = height
                const ctx = newCanvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(layer.data, -x, -y)
                }
                return { ...layer, data: newCanvas }
            })
            return { canvasSize: { width, height }, layers: newLayers }
        })
    }, [updateState])

    const closeImage = useCallback(() => {
        clearHistory({
            layers: [],
            activeLayerId: null,
            selection: null,
            canvasSize: { width: 800, height: 600 }
        })
    }, [clearHistory])

    const setSelectionWrapper = useCallback((sel: Selection | null) => {
        updateState({ selection: sel })
    }, [updateState])

    // Explicit add to history for components that manipulate state externally?
    // Not really needed since we expose wrappers.
    const addToHistory = useCallback(() => {
        // No-op if we use the setters above
    }, [])

    return (
        <EditorContext.Provider value={{
            layers,
            activeLayerId,
            canvasSize,
            selection,
            setCanvasSize: setCanvasSizeWrapper,
            addLayer,
            deleteLayer,
            setActiveLayer,
            toggleLayerVisibility,
            toggleLayerLock,
            setLayerOpacity,
            updateLayerData,
            updateLayerPosition,
            addFilter,
            removeFilter,
            setSelection: setSelectionWrapper,
            reorderLayers,
            closeImage,
            undo,
            redo,
            canUndo,
            canRedo,
            addToHistory,
            cropCanvas
        }}>
            {children}
        </EditorContext.Provider>
    )
}

export const useEditor = () => {
    const context = useContext(EditorContext)
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorProvider')
    }
    return context
}
