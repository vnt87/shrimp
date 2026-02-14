import React, { createContext, useContext, useState, useCallback } from 'react'

export interface Layer {
    id: string
    name: string
    visible: boolean
    locked: boolean
    opacity: number
    blendMode: string
    data: HTMLCanvasElement | null // Offscreen canvas for layer data
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
    addLayer: (name?: string) => string
    deleteLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void
    setLayerOpacity: (id: string, opacity: number) => void
    updateLayerData: (id: string, canvas: HTMLCanvasElement) => void
    updateLayerPosition: (id: string, x: number, y: number) => void
    setSelection: (selection: Selection | null) => void
    reorderLayers: (startIndex: number, endIndex: number) => void
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [layers, setLayers] = useState<Layer[]>([])
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
    const [selection, setSelection] = useState<Selection | null>(null)

    // Helper to create a new layer
    const createLayer = (name: string): Layer => {
        const canvas = document.createElement('canvas')
        canvas.width = canvasSize.width
        canvas.height = canvasSize.height
        return {
            id: Math.random().toString(36).substr(2, 9),
            name,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            data: canvas,
            x: 0,
            y: 0,
            type: 'layer'
        }
    }

    const setCanvasSizeWrapper = useCallback((size: { width: number; height: number }) => {
        setCanvasSize(size)
        // Resize all existing layers? 
        // For now, let's assume image load sets this initially or resize canvas operation handles it.
        // If we resize, we need to copy old data to new sized canvas.
        setLayers(prev => prev.map(layer => {
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
        }))
    }, [])

    const addLayer = useCallback((name: string = 'New Layer') => {
        const newLayer = createLayer(name)
        setLayers(prev => {
            const newLayers = [newLayer, ...prev]
            return newLayers
        })
        setActiveLayerId(newLayer.id)
        return newLayer.id
    }, [canvasSize])

    const updateLayerPosition = useCallback((id: string, x: number, y: number) => {
        setLayers(prev => prev.map(l => {
            if (l.id === id) {
                return { ...l, x, y }
            }
            return l
        }))
    }, [])

    const deleteLayer = useCallback((id: string) => {
        setLayers(prev => {
            const newLayers = prev.filter(l => l.id !== id)
            if (activeLayerId === id && newLayers.length > 0) {
                setActiveLayerId(newLayers[0].id)
            } else if (newLayers.length === 0) {
                setActiveLayerId(null)
            }
            return newLayers
        })
    }, [activeLayerId])

    const setActiveLayer = useCallback((id: string) => {
        setActiveLayerId(id)
    }, [])

    const toggleLayerVisibility = useCallback((id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
    }, [])

    const toggleLayerLock = useCallback((id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l))
    }, [])

    const setLayerOpacity = useCallback((id: string, opacity: number) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l))
    }, [])

    const updateLayerData = useCallback((id: string, canvas: HTMLCanvasElement) => {
        setLayers(prev => prev.map(l => {
            if (l.id === id) {
                // We need to clone it to trigger updates? Or just ref reference?
                // React doesn't deep compare canvas content.
                // Ideally we keep the same canvas object but maybe timestamp update?
                // or replace with new canvas element.
                return { ...l, data: canvas }
            }
            return l
        }))
    }, [])

    const reorderLayers = useCallback((startIndex: number, endIndex: number) => {
        setLayers(prev => {
            const result = Array.from(prev)
            const [removed] = result.splice(startIndex, 1)
            result.splice(endIndex, 0, removed)
            return result
        })
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
            setSelection,
            reorderLayers
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
