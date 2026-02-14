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
    type: 'layer' | 'group' | 'text'
    children?: Layer[] // For groups
    expanded?: boolean
    // Text specific
    text?: string
    textStyle?: {
        fontFamily: string
        fontSize: number
        fill: string
        align?: 'left' | 'center' | 'right' | 'justify'
        fontWeight?: string
        fontStyle?: string
        letterSpacing?: number
    }
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

export interface TransformData {
    x: number
    y: number
    scaleX: number
    scaleY: number
    rotation: number
    skewX: number
    skewY: number
    pivotX: number
    pivotY: number
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
    addTextLayer: (text: string, style: { fontFamily: string, fontSize: number, fill: string, align?: 'left' | 'center' | 'right' | 'justify', fontWeight?: string, fontStyle?: string, letterSpacing?: number }, x: number, y: number) => string
    deleteLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void
    setLayerOpacity: (id: string, opacity: number) => void
    setLayerBlendMode: (id: string, mode: string) => void
    updateLayerData: (id: string, canvas: HTMLCanvasElement) => void
    updateLayerPosition: (id: string, x: number, y: number) => void
    updateLayerText: (id: string, text: string) => void
    addFilter: (layerId: string, filter: LayerFilter) => void
    removeFilter: (layerId: string, filterIndex: number) => void
    updateFilter: (layerId: string, filterIndex: number, params: Record<string, number>) => void
    toggleFilter: (layerId: string, filterIndex: number) => void
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
    cropCanvas: (x: number, y: number, width: number, height: number, deletePixels?: boolean) => void
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

    // Transform
    transientTransforms: Record<string, TransformData>
    setTransientTransform: (layerId: string, transform: TransformData | null) => void
    commitTransform: (layerId: string, transform: TransformData) => void
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

    // Phase 2: Transient transforms for live preview (not in history)
    // Map layerId -> transform data
    const [transientTransforms, setTransientTransforms] = useState<Record<string, TransformData>>({})

    const updateTransientTransform = useCallback((layerId: string, transform: TransformData | null) => {
        setTransientTransforms(prev => {
            if (transform === null) {
                const newState = { ...prev }
                delete newState[layerId]
                return newState
            }
            return { ...prev, [layerId]: transform }
        })
    }, [])

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

    const addTextLayer = useCallback((text: string, style: { fontFamily: string; fontSize: number; fill: string; align?: 'left' | 'center' | 'right' | 'justify', fontWeight?: string, fontStyle?: string, letterSpacing?: number }, x: number, y: number) => {
        let newLayerId = ''
        updateState((prevState) => {
            const newLayer: Layer = {
                id: Math.random().toString(36).substr(2, 9),
                name: text.substring(0, 20) || 'Text Layer',
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: 'normal',
                data: null,
                filters: [],
                x: x,
                y: y,
                type: 'text',
                text,
                textStyle: style
            }
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

    const updateLayerText = useCallback((id: string, text: string) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { text, name: text.substring(0, 20) })
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

    const updateFilter = useCallback((layerId: string, filterIndex: number, params: Record<string, number>) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            const newFilters = [...layer.filters]
            if (newFilters[filterIndex]) {
                newFilters[filterIndex] = { ...newFilters[filterIndex], params: { ...newFilters[filterIndex].params, ...params } }
            }
            return {
                layers: updateLayerInTree(prevState.layers, layerId, { filters: newFilters })
            }
        })
    }, [updateState])

    const toggleFilter = useCallback((layerId: string, filterIndex: number) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            const newFilters = [...layer.filters]
            if (newFilters[filterIndex]) {
                newFilters[filterIndex] = { ...newFilters[filterIndex], enabled: !newFilters[filterIndex].enabled }
            }
            return {
                layers: updateLayerInTree(prevState.layers, layerId, { filters: newFilters })
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

    const commitTransform = useCallback((layerId: string, transform: TransformData) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || !layer.data) return {}

            // Logic to bake transform:
            // 1. Create new canvas large enough to hold the transformed image
            // 2. Draw original onto it with transforms
            // 3. Update layer data and position

            const { width, height } = layer.data
            // Calculate usage of pivot
            const pivotX = transform.pivotX
            const pivotY = transform.pivotY

            // Corners of original image relative to (0,0)
            const corners = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height }
            ]

            // Apply transform to each corner to find bounds
            // The transform is:
            // translate(transX, transY) * translate(pivotX, pivotY) * rotate(r) * scale(sx, sy) * translate(-pivotX, -pivotY)
            // Wait, Pixi logic is:
            // position + (rotation/scale/skew around pivot) - pivot

            // Let's rely on standard 2D matrix math
            const cos = Math.cos(transform.rotation)
            const sin = Math.sin(transform.rotation)

            // Transform matrix components
            // x' = (x - px)*sx*cos - (y - py)*sy*sin + px + tx
            // y' = (x - px)*sx*sin + (y - py)*sy*cos + py + ty
            // Note: transform.x/y in our data is likely the *offset* or the *new position*?
            // "layer.x" is top-left.
            // Let's assume transform.x/y is the *new* top-left visual position if there were no rotation/scale?
            // Or usually, it matches Pixi's "position" property.

            // NOTE: This math is tricky. Let's start with a simplified "Just Bake It" approach.
            // We'll create a canvas with enough padding and draw.

            // Actually, we can use the canvas context's setTransform to simplify.
            // We just need the bounds.

            // For MVP: let's assume specific transform structure from our Overlay.
            // If we use standard affine logic:

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

            corners.forEach(p => {
                // Apply scale/rotate around pivot
                const dx = p.x - pivotX
                const dy = p.y - pivotY

                const scaledX = dx * transform.scaleX
                const scaledY = dy * transform.scaleY

                const rotatedX = scaledX * cos - scaledY * sin
                const rotatedY = scaledX * sin + scaledY * cos

                // Final visual position (ignoring the layer.x translation for now, we just want bounds relative to pivot)
                // actually we need bounds relative to world or layer origin?
                // Let's calculate bounds relative to the pivot.

                minX = Math.min(minX, rotatedX)
                minY = Math.min(minY, rotatedY)
                maxX = Math.max(maxX, rotatedX)
                maxY = Math.max(maxY, rotatedY)
            })

            const newWidth = Math.ceil(maxX - minX)
            const newHeight = Math.ceil(maxY - minY)

            const newCanvas = document.createElement('canvas')
            newCanvas.width = newWidth
            newCanvas.height = newHeight
            const ctx = newCanvas.getContext('2d')
            if (!ctx) return {}

            // Setup transform on new canvas
            // We want (minX, minY) to map to (0,0) in the new canvas
            // So we translate by (-minX, -minY)
            ctx.translate(-minX, -minY)

            // Now apply the same transform we used for points:
            // 1. Rotate around (0,0) (since we prepared points relative to pivot)
            // 2. Scale
            // Wait, context applies operations in reverse order of calls usually, or simplified:
            // transform(a,b,c,d,e,f)

            // Let's use standard steps:
            // Target is pivot-relative space.
            // We want to draw the image which is relative to pivot (0,0 is at -pivotX, -pivotY)

            ctx.rotate(transform.rotation)
            ctx.scale(transform.scaleX, transform.scaleY)
            // Draw image such that pivot is at (0,0) in current context
            // Image (0,0) is at (-pivotX, -pivotY) relative to pivot
            ctx.drawImage(layer.data, -pivotX, -pivotY)

            // Now we have the new image data in newCanvas.
            // Where is it positioned?
            // Its top-left (0,0) corresponds to `minX, minY` relative to the pivot center.
            // The pivot center is at `transform.x + pivotX`? NO.
            // In Pixi/Our model:
            // Original layer top-left was `layer.x, layer.y`.
            // The transform happened relative to that.
            // `transform.x` is the *new* `layer.x` (Pixi position).

            // The visual pivot in world space is `transform.x + pivotX` (if pivot is offset).
            // The new top-left corner (0,0 of newCanvas) is at `(transform.x + pivotX) + minX, (transform.y + pivotY) + minY`.
            // Wait, Pixi `position` (transform.x) usually refers to the anchor/pivot point if anchor is set?
            // No, Pixi default anchor is 0,0.

            // Let's assume `transform.x` is the *visual position of the top-left corner* (or whatever the tool updates).
            // Actually, if we use a Transform Tool, usually we drag the box.

            // Let's assume `transform.x/y` is the Layer's (0,0) position in parent space.
            // And pivot is local to the layer.

            // The "pivot point" in world space was `originalX + pivotX, originalY + pivotY`.
            // After transform, that point might move if `transform.x` moves.

            // Let's simplify:
            // The new layer's top-left position will be:
            // `transform.x` (base pos) + `pivotX` (offset to pivot) + `minX` (offset to new, rotated top-left).
            // Wait, `transform.x` is the *updated* layer position.
            // If the user didn't move the handle, just rotated, `transform.x` stays same.

            // Correct logic:
            // New Layer X = transform.x + minX + (something about pivot?)
            // Actually, `transform.x` is the position of the *origin* (top-left of pre-transform content).
            // We are baking the transform.
            // So the new origin (top-left of new content) should be:
            // NewX = transform.x + (minX calculated relative to pivot) + pivotX * (rotated?) -> complex.

            // Let's assume the TransformOverlay gives us the *visual* `x, y` of the layer.
            // We'll refine this when we build the component.
            // For now:
            const newLayerX = transform.x + minX + pivotX // This assumes (transform.x + pivotX) is the center of rotation
            const newLayerY = transform.y + minY + pivotY

            // BUT wait, if we bake, we reset rotation/scale to 0/1.
            // The pivot is usually irrelevant after baking?

            // Let's try this:
            // New X = transform.x + minX + pivotX (adjusting for the fact that minX is negative relative to pivot) -- wait.
            // Pivot is (px, py).
            // Origin is (0,0).
            // Origin relative to pivot is (-px, -py).
            // Rotated origin is ...

            // Let's trust the minX/minY (relative to pivot).
            // The pivot in world space is `transform.x + pivotX`.  (Using the transform's x/y).
            // The new top-left is `(WorldPivot) + (minX, minY)`.
            // So `newLayerX = transform.x + pivotX + minX`.
            // `newLayerY = transform.y + pivotY + minY`.

            // This seems plausible!

            // Clean up transient
            setTransientTransforms(prev => {
                const copy = { ...prev }
                delete copy[layerId]
                return copy
            })

            return {
                layers: updateLayerInTree(prevState.layers, layerId, {
                    data: newCanvas,
                    x: newLayerX,
                    y: newLayerY
                })
            }
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


    const cropCanvas = useCallback((x: number, y: number, width: number, height: number, deletePixels: boolean = true) => {
        updateState(prevState => {
            if (deletePixels) {
                // Destructive crop (original behavior)
                const cropRecursive = (list: Layer[]): Layer[] => {
                    return list.map(layer => {
                        let newData = layer.data
                        if (layer.data) {
                            const newCanvas = document.createElement('canvas')
                            newCanvas.width = width
                            newCanvas.height = height
                            const ctx = newCanvas.getContext('2d')
                            if (ctx) {
                                // Draw the portion of the layer that intersects with the crop area
                                // Layer is at layer.x, layer.y
                                // Crop area is at x, y
                                // We want to draw layer at (layer.x - x, layer.y - y)
                                ctx.drawImage(layer.data, layer.x - x, layer.y - y)
                            }
                            newData = newCanvas
                        }
                        const newChildren = layer.children ? cropRecursive(layer.children) : undefined

                        // Update position: layer is now relative to new 0,0 (which was x,y)
                        // But since we redrew the data into a new canvas at 0,0, the layer position should be 0,0?
                        // Wait, if we redraw, we lose the original layer bounds if we just draw at 0,0.
                        // Actually, GIMP crop usually resets layer positions or crops them.
                        // In our previous implementation: `ctx.drawImage(layer.data, -x, -y)`
                        // This assumed layer was at 0,0? No, `layer.data` is the canvas.
                        // The previous implementation was likely buggy if layers were moved.

                        // Correct logic for destructive crop:
                        // 1. Create new canvas of crop size.
                        // 2. Draw existing layer onto it, offset by (layer.x - cropX, layer.y - cropY).
                        // 3. Set layer.x, layer.y to 0? Or keep them relative?
                        // If we draw exactly what's visible in the crop rect, the new layer data represents the cropped view.
                        // So layer.x/y should become 0 (relative to the new canvas origin).
                        // However, if the layer was smaller and inside the crop, we might want to keep it minimal?
                        // GIMP standard crop: Layers are clipped to the selection.

                        return {
                            ...layer,
                            data: newData,
                            x: 0,
                            y: 0,
                            children: newChildren
                        }
                    })
                }
                return { canvasSize: { width, height }, layers: cropRecursive(prevState.layers) }
            } else {
                // Non-destructive crop: Just change canvas size and shift layers
                const shiftRecursive = (list: Layer[]): Layer[] => {
                    return list.map(layer => {
                        const newChildren = layer.children ? shiftRecursive(layer.children) : undefined
                        return {
                            ...layer,
                            x: layer.x - x,
                            y: layer.y - y,
                            children: newChildren
                        }
                    })
                }
                return { canvasSize: { width, height }, layers: shiftRecursive(prevState.layers) }
            }
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
            addTextLayer,
            deleteLayer,
            setActiveLayer,
            toggleLayerVisibility,
            toggleLayerLock,
            setLayerOpacity,
            setLayerBlendMode,
            updateLayerData,
            updateLayerPosition,
            updateLayerText,
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
            updateGuide,
            // Phase 2
            transientTransforms,
            setTransientTransform: updateTransientTransform,
            commitTransform,
            // Phase 1
            updateFilter,
            toggleFilter
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
