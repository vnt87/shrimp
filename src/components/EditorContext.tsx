import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
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
    expanded?: boolean
}

export interface Selection {
    type: 'rect' | 'ellipse' | 'path'
    x: number
    y: number
    width: number
    height: number
    path?: { x: number; y: number }[]
}

export interface Guide {
    id: string
    orientation: 'horizontal' | 'vertical'
    position: number // In canvas coordinates
}

interface EditorContextType {
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null
    guides: Guide[]

    // Colors
    foregroundColor: string
    backgroundColor: string
    setForegroundColor: (color: string) => void
    setBackgroundColor: (color: string) => void
    swapColors: () => void
    resetColors: () => void

    // Actions
    setCanvasSize: (size: { width: number; height: number }) => void
    addLayer: (name?: string, initialData?: HTMLCanvasElement) => string
    deleteLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void
    setLayerOpacity: (id: string, opacity: number) => void
    setLayerBlendMode: (id: string, mode: string) => void
    updateLayerData: (id: string, canvas: HTMLCanvasElement) => void
    updateLayerPosition: (id: string, x: number, y: number) => void
    addFilter: (layerId: string, filter: LayerFilter) => void
    removeFilter: (layerId: string, filterIndex: number) => void
    setSelection: (selection: Selection | null) => void
    reorderLayers: (startIndex: number, endIndex: number) => void

    // Selection actions
    selectAll: () => void
    selectNone: () => void
    invertSelection: () => void

    // Image actions
    flattenImage: () => void
    mergeDown: () => void
    exportImage: (format?: string, quality?: number) => void
    newImage: (width: number, height: number, bgColor: string) => void

    // History
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    addToHistory: () => void
    cropCanvas: (x: number, y: number, width: number, height: number) => void
    closeImage: () => void

    // Layer management
    selectedLayerIds: string[]
    setSelectedLayerIds: (ids: string[]) => void
    duplicateLayer: (id: string) => void
    createGroup: (layerIds?: string[]) => void
    moveLayer: (dragId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => void
    renameLayer: (id: string, name: string) => void
    toggleGroupExpanded?: (id: string) => void

    // Guide actions
    addGuide: (guide: Omit<Guide, 'id'>) => string
    removeGuide: (id: string) => void
    updateGuide: (id: string, position: number) => void
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

// Define the state we want to track in history
interface EditorState {
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null
    guides: Guide[]
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
    // Initial state
    const emptyState: EditorState = {
        layers: [],
        activeLayerId: null,
        canvasSize: { width: 800, height: 600 },
        selection: null,
        guides: []
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
    const { layers, activeLayerId, canvasSize, selection, guides } = historyState
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])

    // FG/BG colors (not tracked in history)
    const [foregroundColor, setForegroundColor] = useState('#000000')
    const [backgroundColor, setBackgroundColor] = useState('#ffffff')

    const swapColors = useCallback(() => {
        const fg = foregroundColor
        setForegroundColor(backgroundColor)
        setBackgroundColor(fg)
    }, [foregroundColor, backgroundColor])

    const resetColors = useCallback(() => {
        setForegroundColor('#000000')
        setBackgroundColor('#ffffff')
    }, [])

    // Update selectedLayerIds when activeLayerId changes to ensure sync if needed
    // But usually activeLayerId is just the "primary" selected layer.
    // For now, let's keep them somewhat separate or sync them.
    // If activeLayerId changes, it should probably be in selectedLayerIds.
    useEffect(() => {
        if (activeLayerId && !selectedLayerIds.includes(activeLayerId)) {
            setSelectedLayerIds([activeLayerId])
        }
    }, [activeLayerId])

    const updateState = useCallback((updates: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>)) => {
        setHistoryState(prevFullState => {
            const newPart = typeof updates === 'function' ? updates(prevFullState) : updates
            return {
                ...prevFullState,
                ...newPart
            }
        })
    }, [setHistoryState])

    // --- Helpers for recursive layer operations ---

    const findLayerById = (layers: Layer[], id: string): Layer | null => {
        for (const layer of layers) {
            if (layer.id === id) return layer
            if (layer.children) {
                const found = findLayerById(layer.children, id)
                if (found) return found
            }
        }
        return null
    }

    const updateLayerInTree = (layers: Layer[], id: string, updates: Partial<Layer>): Layer[] => {
        return layers.map(layer => {
            if (layer.id === id) {
                return { ...layer, ...updates }
            }
            if (layer.children) {
                return { ...layer, children: updateLayerInTree(layer.children, id, updates) }
            }
            return layer
        })
    }

    const removeLayerFromTree = (layers: Layer[], id: string): { layers: Layer[], removed: Layer | null } => {
        let removed: Layer | null = null
        const filter = (list: Layer[]): Layer[] => {
            const result: Layer[] = []
            for (const layer of list) {
                if (layer.id === id) {
                    removed = layer
                    continue
                }
                if (layer.children) {
                    layer.children = filter(layer.children)
                }
                result.push(layer)
            }
            return result
        }
        const newLayers = filter(layers)
        return { layers: newLayers, removed }
    }

    // Deep clone a layer (for duplication)
    const cloneLayer = (layer: Layer): Layer => {
        let newData: HTMLCanvasElement | null = null
        if (layer.data) {
            newData = document.createElement('canvas')
            newData.width = layer.data.width
            newData.height = layer.data.height
            newData.getContext('2d')?.drawImage(layer.data, 0, 0)
        }

        return {
            ...layer,
            id: Math.random().toString(36).substr(2, 9),
            name: layer.name + ' Copy',
            data: newData,
            children: layer.children ? layer.children.map(cloneLayer) : undefined,
            expanded: layer.expanded
        }
    }


    // --- Actions ---

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
            // This only handles top-level layers for resizing?
            // Should probably recurse.
            const resizeLayers = (list: Layer[]): Layer[] => {
                return list.map(layer => {
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
                    if (layer.children) {
                        return { ...layer, children: resizeLayers(layer.children) }
                    }
                    return layer
                })
            }
            return { canvasSize: size, layers: resizeLayers(prevState.layers) }
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
            layers: updateLayerInTree(prevState.layers, id, { x, y })
        }))
    }, [updateState])

    const deleteLayer = useCallback((id: string) => {
        updateState(prevState => {
            const { layers: newLayers } = removeLayerFromTree(prevState.layers, id)
            // If active layer was deleted, reset active ID
            let newActiveId = prevState.activeLayerId
            if (prevState.activeLayerId === id) {
                // Simplification: just unset or pick first
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
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, id)
            return {
                layers: updateLayerInTree(prevState.layers, id, { visible: !layer?.visible })
            }
        })
    }, [updateState])

    // Added: Toggle Group Expansion
    const toggleGroupExpanded = useCallback((id: string) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, id)
            return {
                layers: updateLayerInTree(prevState.layers, id, { expanded: !layer?.expanded })
            }
        })
    }, [updateState])


    const toggleLayerLock = useCallback((id: string) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, id)
            return {
                layers: updateLayerInTree(prevState.layers, id, { locked: !layer?.locked })
            }
        })
    }, [updateState])

    const setLayerOpacity = useCallback((id: string, opacity: number) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { opacity })
        }))
    }, [updateState])

    const setLayerBlendMode = useCallback((id: string, mode: string) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { blendMode: mode })
        }))
    }, [updateState])

    const updateLayerData = useCallback((id: string, canvas: HTMLCanvasElement) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { data: canvas })
        }))
    }, [updateState])

    const addFilter = useCallback((layerId: string, filter: LayerFilter) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            return {
                layers: updateLayerInTree(prevState.layers, layerId, { filters: [...layer.filters, filter] })
            }
        })
    }, [updateState])

    const removeFilter = useCallback((layerId: string, filterIndex: number) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            return {
                layers: updateLayerInTree(prevState.layers, layerId, { filters: layer.filters.filter((_, i) => i !== filterIndex) })
            }
        })
    }, [updateState])

    const reorderLayers = useCallback((_startIndex: number, _endIndex: number) => {
        // This was the old flat reorder.
        // We need a robust "moveLayer" that handles nesting.
        // Keeping this for backward compatibility if needed, but 'moveLayer' is better.
    }, [])

    const duplicateLayer = useCallback((id: string) => {
        updateState(prevState => {
            const layerToDup = findLayerById(prevState.layers, id)
            if (!layerToDup) return {}

            const newLayer = cloneLayer(layerToDup)

            // Insert after the original
            const insertAfter = (list: Layer[]): Layer[] => {
                const newList: Layer[] = []
                for (const l of list) {
                    newList.push(l)
                    if (l.id === id) {
                        newList.push(newLayer)
                    } else if (l.children) {
                        l.children = insertAfter(l.children)
                    }
                }
                return newList
            }

            return { layers: insertAfter(prevState.layers) }
        })
    }, [updateState])

    const createGroup = useCallback((layerIds?: string[]) => {
        updateState(prevState => {
            const idsToGroup = layerIds || (prevState.activeLayerId ? [prevState.activeLayerId] : [])
            if (idsToGroup.length === 0) return {}

            const groupLayer: Layer = {
                id: Math.random().toString(36).substr(2, 9),
                name: 'Group',
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: 'normal',
                data: null,
                filters: [],
                x: 0,
                y: 0,
                type: 'group',
                children: [],
                expanded: true
            }

            // We need to:
            // 1. Remove selected layers from their current positions
            // 2. Add them to the group
            // 3. Insert the group at the position of the first selected layer (or top)

            // New approach: Filter out selected layers, then insert group at "top-most" selected index?
            // Or simpler: Just add group at top, put layers in it.
            // Better UX: Replace the selected layers with the group in the list.

            // 1. Find the layers to move
            const movingLayers: Layer[] = []

            // Helper to collect and remove
            const collectAndRemove = (list: Layer[]): Layer[] => {
                const retained: Layer[] = []
                for (const l of list) {
                    if (idsToGroup.includes(l.id)) {
                        movingLayers.push(l)
                    } else {
                        if (l.children) {
                            l.children = collectAndRemove(l.children)
                        }
                        retained.push(l)
                    }
                }
                return retained
            }

            const layersWithoutMoved = collectAndRemove(prevState.layers)

            // 2. Add them to group
            // Sort movingLayers by original order? Complexity. Just push for now.
            // Ideally we preserve the relative order.
            // Since we implemented collectAndRemove recursively/sequentially, `movingLayers` should be in DFS order.
            groupLayer.children = movingLayers

            // 3. Where to put the group?
            // Put it at the top of the root list for now, or at index 0 of the first removed layer's parent?
            // Simplest valid MVP: Add group to top of list.

            return {
                layers: [groupLayer, ...layersWithoutMoved],
                activeLayerId: groupLayer.id
            }
        })
    }, [updateState])

    const moveLayer = useCallback((dragId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => {
        updateState(prevState => {
            // 1. Find and remove dragged layer
            const { layers: layersWithoutDrag, removed: draggedLayer } = removeLayerFromTree(prevState.layers, dragId)
            if (!draggedLayer) return {}

            // 2. Insert at target
            if (!targetId) {
                // If no target, maybe append to root?
                return { layers: [...layersWithoutDrag, draggedLayer] }
            }

            const insert = (list: Layer[]): Layer[] => {
                const newList: Layer[] = []
                for (const l of list) {
                    if (l.id === targetId) {
                        if (position === 'before') {
                            newList.push(draggedLayer)
                            newList.push(l)
                        } else if (position === 'after') {
                            newList.push(l)
                            newList.push(draggedLayer)
                        } else if (position === 'inside') {
                            // Add to children
                            const newChildren = l.children ? [...l.children, draggedLayer] : [draggedLayer]
                            newList.push({ ...l, children: newChildren, expanded: true })
                        }
                    } else {
                        if (l.children) {
                            l.children = insert(l.children)
                        }
                        newList.push(l)
                    }
                }
                return newList
            }

            return { layers: insert(layersWithoutDrag) }
        })
    }, [updateState])

    const renameLayer = useCallback((id: string, newName: string) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { name: newName })
        }))
    }, [updateState])


    // --- Guide Actions ---

    const addGuide = useCallback((guideData: Omit<Guide, 'id'>) => {
        let newId = ''
        updateState(prevState => {
            const id = Math.random().toString(36).substr(2, 9)
            newId = id
            const newGuide: Guide = { ...guideData, id }
            return { guides: [...prevState.guides, newGuide] }
        })
        return newId
    }, [updateState])

    const removeGuide = useCallback((id: string) => {
        updateState(prevState => ({
            guides: prevState.guides.filter(g => g.id !== id)
        }))
    }, [updateState])

    const updateGuide = useCallback((id: string, position: number) => {
        updateState(prevState => ({
            guides: prevState.guides.map(g => g.id === id ? { ...g, position } : g)
        }))
    }, [updateState])


    const cropCanvas = useCallback((x: number, y: number, width: number, height: number) => {
        updateState(prevState => {
            const cropRecursive = (list: Layer[]): Layer[] => {
                return list.map(layer => {
                    let newData = layer.data
                    if (layer.data) {
                        const newCanvas = document.createElement('canvas')
                        newCanvas.width = width
                        newCanvas.height = height
                        const ctx = newCanvas.getContext('2d')
                        if (ctx) {
                            ctx.drawImage(layer.data, -x, -y)
                        }
                        newData = newCanvas
                    }
                    if (layer.children) {
                        return { ...layer, data: newData, children: cropRecursive(layer.children) }
                    }
                    return { ...layer, data: newData }
                })
            }

            return { canvasSize: { width, height }, layers: cropRecursive(prevState.layers) }
        })
    }, [updateState])

    const closeImage = useCallback(() => {
        clearHistory({
            layers: [],
            activeLayerId: null,
            selection: null,
            canvasSize: { width: 800, height: 600 },
            guides: []
        })
    }, [clearHistory])

    const setSelectionWrapper = useCallback((sel: Selection | null) => {
        updateState({ selection: sel })
    }, [updateState])

    // --- Selection Actions ---
    const selectAll = useCallback(() => {
        updateState(prevState => ({
            selection: {
                type: 'rect' as const,
                x: 0,
                y: 0,
                width: prevState.canvasSize.width,
                height: prevState.canvasSize.height
            }
        }))
    }, [updateState])

    const selectNone = useCallback(() => {
        updateState({ selection: null })
    }, [updateState])

    const invertSelection = useCallback(() => {
        updateState(prevState => {
            if (!prevState.selection) {
                // If no selection, select all
                return {
                    selection: {
                        type: 'rect' as const,
                        x: 0,
                        y: 0,
                        width: prevState.canvasSize.width,
                        height: prevState.canvasSize.height
                    }
                }
            }
            // For simple rect selections, we can't truly invert geometrically
            // in our current model (single rect). Just clear selection for now.
            // A full implementation would need a mask-based selection model.
            return { selection: null }
        })
    }, [updateState])

    // --- Image Actions ---
    const flattenImage = useCallback(() => {
        updateState(prevState => {
            if (prevState.layers.length === 0) return {}

            const { width, height } = prevState.canvasSize
            const flatCanvas = document.createElement('canvas')
            flatCanvas.width = width
            flatCanvas.height = height
            const ctx = flatCanvas.getContext('2d')
            if (!ctx) return {}

            // Collect all visible layers in render order (bottom to top = reversed array)
            const collectVisible = (list: Layer[]): Layer[] => {
                const result: Layer[] = []
                for (const l of list) {
                    if (!l.visible) continue
                    if (l.type === 'group' && l.children) {
                        result.push(...collectVisible(l.children))
                    } else if (l.data) {
                        result.push(l)
                    }
                }
                return result
            }

            const visibleLayers = collectVisible(prevState.layers).reverse()

            for (const layer of visibleLayers) {
                if (!layer.data) continue
                ctx.globalAlpha = layer.opacity / 100
                ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation) || 'source-over'
                ctx.drawImage(layer.data, layer.x, layer.y)
            }

            ctx.globalAlpha = 1
            ctx.globalCompositeOperation = 'source-over'

            const flatLayer: Layer = {
                id: Math.random().toString(36).substr(2, 9),
                name: 'Flattened',
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: 'normal',
                data: flatCanvas,
                filters: [],
                x: 0,
                y: 0,
                type: 'layer'
            }

            return {
                layers: [flatLayer],
                activeLayerId: flatLayer.id
            }
        })
    }, [updateState])

    const mergeDown = useCallback(() => {
        updateState(prevState => {
            if (!prevState.activeLayerId) return {}
            // Find active layer index in top-level (simplified)
            const idx = prevState.layers.findIndex(l => l.id === prevState.activeLayerId)
            if (idx < 0 || idx >= prevState.layers.length - 1) return {}

            const upper = prevState.layers[idx]
            const lower = prevState.layers[idx + 1]
            if (!upper.data || !lower.data) return {}

            const mergedCanvas = document.createElement('canvas')
            mergedCanvas.width = prevState.canvasSize.width
            mergedCanvas.height = prevState.canvasSize.height
            const ctx = mergedCanvas.getContext('2d')
            if (!ctx) return {}

            ctx.globalAlpha = lower.opacity / 100
            ctx.drawImage(lower.data, lower.x, lower.y)
            ctx.globalAlpha = upper.opacity / 100
            ctx.drawImage(upper.data, upper.x, upper.y)
            ctx.globalAlpha = 1

            const mergedLayer: Layer = {
                ...lower,
                data: mergedCanvas,
                x: 0,
                y: 0,
                name: lower.name
            }

            const newLayers = prevState.layers.filter((_, i) => i !== idx)
            newLayers[idx] = mergedLayer // replace lower with merged
            // Wait, idx was already removed, so index shifted.
            // Actually: we removed upper (at idx), so lower is now at idx.
            const finalLayers = prevState.layers.filter(l => l.id !== upper.id).map(l =>
                l.id === lower.id ? mergedLayer : l
            )

            return {
                layers: finalLayers,
                activeLayerId: mergedLayer.id
            }
        })
    }, [updateState])

    const exportImage = useCallback((format: string = 'png', quality: number = 0.92) => {
        const { width, height } = canvasSize
        if (layers.length === 0) return

        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = width
        exportCanvas.height = height
        const ctx = exportCanvas.getContext('2d')
        if (!ctx) return

        // Collect all visible layers in render order
        const collectVisible = (list: Layer[]): Layer[] => {
            const result: Layer[] = []
            for (const l of list) {
                if (!l.visible) continue
                if (l.type === 'group' && l.children) {
                    result.push(...collectVisible(l.children))
                } else if (l.data) {
                    result.push(l)
                }
            }
            return result
        }

        const visibleLayers = collectVisible(layers).reverse()

        for (const layer of visibleLayers) {
            if (!layer.data) continue
            ctx.globalAlpha = layer.opacity / 100
            ctx.drawImage(layer.data, layer.x, layer.y)
        }

        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
        const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

        exportCanvas.toBlob((blob) => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `shrimp-export.${ext}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }, mimeType, quality)
    }, [canvasSize, layers])

    const newImage = useCallback((width: number, height: number, bgColor: string) => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        if (bgColor !== 'transparent') {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = bgColor
                ctx.fillRect(0, 0, width, height)
            }
        }

        const layer: Layer = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Background',
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

        clearHistory({
            layers: [layer],
            activeLayerId: layer.id,
            canvasSize: { width, height },
            selection: null,
            guides: []
        })
    }, [clearHistory])

    // Explicit add to history for components that manipulate state externally?
    // Not really needed since we use the setters above.
    const addToHistory = useCallback(() => {
        // No-op if we use the setters above
    }, [])

    return (
        <EditorContext.Provider value={{
            layers,
            activeLayerId,
            canvasSize,
            selection,
            // Colors
            foregroundColor,
            backgroundColor,
            setForegroundColor,
            setBackgroundColor,
            swapColors,
            resetColors,
            // Canvas actions
            setCanvasSize: setCanvasSizeWrapper,
            addLayer,
            deleteLayer,
            setActiveLayer,
            toggleLayerVisibility,
            toggleLayerLock,
            setLayerOpacity,
            setLayerBlendMode,
            updateLayerData,
            updateLayerPosition,
            addFilter,
            removeFilter,
            setSelection: setSelectionWrapper,
            reorderLayers,
            // Selection actions
            selectAll,
            selectNone,
            invertSelection,
            // Image actions
            flattenImage,
            mergeDown,
            exportImage,
            newImage,
            // History
            closeImage,
            undo,
            redo,
            canUndo,
            canRedo,
            addToHistory,
            cropCanvas,
            // Layer management
            selectedLayerIds,
            setSelectedLayerIds,
            duplicateLayer,
            createGroup,
            moveLayer,
            renameLayer,
            toggleGroupExpanded,
            // Guide exports
            guides,
            addGuide,
            removeGuide,
            updateGuide
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
