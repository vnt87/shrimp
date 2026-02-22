import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { PersistenceManager } from '../utils/persistence'

import { createVectorPath, duplicatePath as duplicateVectorPath } from '../path/commands'
import type { VectorPath } from '../path/types'
import { BrushEngine } from '../utils/brushEngine'
import { BrushPreset } from '../types/brush'
import type { GradientResource } from '../types/gradient'
import { GGRParser } from '../utils/ggrParser'
import type { VectorShape, ShapeLayerData, ShapePrimitiveType, ShapeFill, ShapeStroke } from '../types/shape'
import { DEFAULT_SHAPE_FILL, DEFAULT_SHAPE_STROKE } from '../types/shape'
import { createShapeLayerData, createVectorShape, cloneShape, renderShapeLayer } from '../utils/shapeUtils'
import { createRectPath, createEllipsePath, createPolygonPath, createLinePath } from '../utils/shapeUtils'

export interface LayerFilter {
    type: 'blur' | 'brightness' | 'hue-saturation' | 'noise' | 'color-matrix' | 'pixelate' | 'glitch' | 'old-film' | 'adjustment' | 'ascii' | 'dot' | 'emboss' | 'cross-hatch' | 'bulge-pinch' | 'twist' | 'reflection' | 'shockwave' | 'crt' | 'rgb-split' | 'bloom' | 'godray' | 'tilt-shift' | 'zoom-blur' | 'motion-blur' | 'custom'
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
    type: 'layer' | 'group' | 'text' | 'shape'
    children?: Layer[] // For groups
    expanded?: boolean
    renderVersion?: number // Used to force texture updates without changing canvas reference
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
        lineHeight?: number
        textDecoration?: 'none' | 'underline' | 'line-through'
        wordWrap?: boolean
        wordWrapWidth?: number
    }
    // Shape specific
    shapeData?: ShapeLayerData
}

export interface Selection {
    type: 'rect' | 'ellipse' | 'path'
    x: number
    y: number
    width: number
    height: number
    path?: { x: number; y: number }[]
}

export interface ClipboardData {
    canvas: HTMLCanvasElement
    x: number  // Original position in canvas coordinates
    y: number
}

export interface Guide {
    id: string
    orientation: 'horizontal' | 'vertical'
    position: number // In canvas coordinates
}

export interface HistoryEntry {
    index: number
    label: string
    isCurrent: boolean
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

export interface HistogramData {
    r: number[]
    g: number[]
    b: number[]
    lum: number[]
}

// --- Multi-Document Types ---

export type ChannelType = 'r' | 'g' | 'b' | 'lum'

export interface EditorContent {
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null
    guides: Guide[]
    paths: VectorPath[]
    activePathId: string | null
}

interface HistoryState<T> {
    past: T[]
    present: T
    future: T[]
}

export interface Document {
    id: string
    name: string
    // The content that is tracked in history
    history: HistoryState<EditorContent>
    // Transient state per document (zoom, scroll, view transform? - maybe later)
    // For now, let's keep transient transforms global or map them by docId+layerId
}

interface EditorContextType {
    // Document Management
    documents: Document[]
    activeDocumentId: string | null
    activeDocument: Document | null
    addDocument: (initialContent?: Partial<EditorContent>, name?: string) => void
    loadDocument: (content: EditorContent, name: string) => void
    closeDocument: (id: string) => void
    setActiveDocumentId: (id: string) => void

    // Original properties (proxied to active document)
    layers: Layer[]
    activeLayerId: string | null
    canvasSize: { width: number; height: number }
    selection: Selection | null
    guides: Guide[]
    paths: VectorPath[]
    activePathId: string | null
    activePath: VectorPath | null
    activePathNodeId: string | null

    // Clone Stamp
    cloneSource: { x: number, y: number } | null
    setCloneSource: (source: { x: number, y: number } | null) => void

    // Colors (Global)
    foregroundColor: string
    backgroundColor: string
    setForegroundColor: (color: string) => void
    setBackgroundColor: (color: string) => void
    swapColors: () => void
    resetColors: () => void

    // Channels
    activeChannels: ChannelType[]
    toggleChannel: (channel: ChannelType) => void
    setActiveChannels: (channels: ChannelType[]) => void

    // Actions (Applied to active document)
    setCanvasSize: (size: { width: number; height: number }) => void
    addLayer: (name?: string, initialData?: HTMLCanvasElement) => string
    addTextLayer: (text: string, style: NonNullable<Layer['textStyle']>, x: number, y: number) => string
    deleteLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void
    setLayerOpacity: (id: string, opacity: number) => void
    setLayerBlendMode: (id: string, mode: string) => void
    updateLayerData: (id: string, canvas: HTMLCanvasElement, history?: boolean) => void
    updateLayerPosition: (id: string, x: number, y: number, history?: boolean) => void
    refreshLayerRender: (id: string) => void // Force texture update without changing data
    updateLayerText: (id: string, text: string) => void
    updateLayerTextStyle: (id: string, style: Partial<NonNullable<Layer['textStyle']>>, history?: boolean) => void
    addFilter: (layerId: string, filter: LayerFilter) => void
    setLayerFilters: (layerId: string, filters: LayerFilter[], history?: boolean) => void
    removeFilter: (layerId: string, filterIndex: number) => void
    updateFilter: (layerId: string, filterIndex: number, params: Record<string, number>) => void
    toggleFilter: (layerId: string, filterIndex: number) => void
    setSelection: (selection: Selection | null) => void
    reorderLayers: (startIndex: number, endIndex: number) => void

    // Selection actions
    selectAll: () => void
    selectNone: () => void
    invertSelection: () => void

    // Copy/Paste actions
    copySelection: (merged?: boolean) => void
    pasteSelection: () => void

    // Image actions
    flattenImage: () => void
    mergeDown: () => void
    exportImage: (format?: string, quality?: number) => void
    newImage: (width: number, height: number, bgColor: string) => void
    openImage: (name: string, canvas: HTMLCanvasElement) => void

    // History
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    historyEntries: HistoryEntry[]
    historyCurrentIndex: number
    restoreHistoryIndex: (index: number) => void
    addToHistory: () => void // Explicit commit? Usually implicit via set/replace
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

    // Path actions
    createPath: (name?: string) => string
    setActivePathId: (id: string | null) => void
    updatePath: (pathId: string, updater: (path: VectorPath) => VectorPath, history?: boolean) => void
    renamePath: (pathId: string, name: string) => void
    duplicatePath: (pathId: string) => string | null
    deletePath: (pathId: string) => void
    setPathVisibility: (pathId: string, visible: boolean) => void
    setPathLocked: (pathId: string, locked: boolean) => void
    setActivePathNodeId: (nodeId: string | null) => void

    // Transform
    transientTransforms: Record<string, TransformData>
    setTransientTransform: (layerId: string, transform: TransformData | null) => void
    commitTransform: (layerId: string, transform: TransformData) => void

    // Generative Fill modal visibility flag
    genFillModalOpen: boolean
    setGenFillModalOpen: (open: boolean) => void

    // Content-Aware Fill modal visibility flag
    cafModalOpen: boolean
    setCAFModalOpen: (open: boolean) => void

    // Cursor Info (for InfoPanel)
    cursorInfo: { x: number, y: number, color: string | null }
    setCursorInfo: (info: { x: number, y: number, color: string | null }) => void

    // View Transform (for Navigator)
    viewTransform: { scale: number, offsetX: number, offsetY: number }
    setViewTransform: React.Dispatch<React.SetStateAction<{ scale: number, offsetX: number, offsetY: number }>>
    viewportSize: { width: number, height: number }
    setViewportSize: (size: { width: number; height: number }) => void

    // Histogram Data (Transient)
    histogramData: HistogramData | null
    setHistogramData: (data: HistogramData | null) => void

    // Brush Engine
    brushEngine: BrushEngine
    availableBrushes: BrushPreset[]
    activeBrushId: string | null
    setActiveBrushId: (id: string) => void
    importBrush: (blob: Blob, name: string) => Promise<void>

    // Gradients
    availableGradients: GradientResource[]
    activeGradient: GradientResource | null
    setActiveGradient: (gradient: GradientResource | null) => void
    importGradient: (file: File) => Promise<void>

    // Shape Layers
    addShapeLayer: (name?: string) => string
    addShapeToLayer: (layerId: string, shapeType: ShapePrimitiveType, params: {
        x: number
        y: number
        width: number
        height: number
        cornerRadius?: number
        sides?: number
        fill?: Partial<ShapeFill>
        stroke?: Partial<ShapeStroke>
    }) => string | null
    updateShape: (layerId: string, shapeId: string, updates: Partial<VectorShape>, history?: boolean) => void
    deleteShape: (layerId: string, shapeId: string) => void
    setActiveShape: (layerId: string, shapeId: string | null) => void
    duplicateShape: (layerId: string, shapeId: string) => string | null
    updateShapeFill: (layerId: string, shapeId: string, fill: Partial<ShapeFill>, history?: boolean) => void
    updateShapeStroke: (layerId: string, shapeId: string, stroke: Partial<ShapeStroke>, history?: boolean) => void
    renderShapeLayerToCanvas: (layerId: string) => HTMLCanvasElement | null
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

function createInitialContent(width = 800, height = 600): EditorContent {
    return {
        layers: [],
        activeLayerId: null,
        canvasSize: { width, height },
        selection: null,
        guides: [],
        paths: [],
        activePathId: null
    }
}

function createDocument(name: string, content: EditorContent): Document {
    return {
        id: Math.random().toString(36).substr(2, 9),
        name,
        history: {
            past: [],
            present: content,
            future: []
        }
    }
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
    // --- State ---
    // Start with one untitled document
    const [documents, setDocuments] = useState<Document[]>(() => [
        createDocument('Untitled-1', createInitialContent())
    ])
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documents[0].id)
    const [isLoading, setIsLoading] = useState(true)

    // Load state from persistence on mount
    useEffect(() => {
        const load = async () => {
            const savedState = await PersistenceManager.loadState()
            if (savedState) {
                const newDoc = createDocument('Restored Session', savedState)
                setDocuments([newDoc])
                setActiveDocumentId(newDoc.id)
            }
            setIsLoading(false)
        }
        load()
    }, [])

    // Save state on change (debounced)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (isLoading) return

        const activeDoc = documents.find(d => d.id === activeDocumentId)
        if (!activeDoc) return

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(() => {
            PersistenceManager.saveState(activeDoc.history.present)
        }, 2000) // Auto-save after 2 seconds of inactivity

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [documents, activeDocumentId, isLoading])

    // Computed active document
    const activeDocument = useMemo(() =>
        documents.find(d => d.id === activeDocumentId) || null
        , [documents, activeDocumentId])

    // Fallback for when no document is active (shouldn't really happen in UI, but for safety)
    const emptyContent = useMemo(() => createInitialContent(), [])

    // Proxy state from active document
    const currentContent = activeDocument ? activeDocument.history.present : emptyContent
    const { layers, activeLayerId, canvasSize, selection, guides, paths, activePathId } = currentContent

    // Helper to update active document's history
    const updateActiveDocument = useCallback((
        updateFn: (doc: Document) => Document
    ) => {
        setDocuments(prev => prev.map(doc => {
            if (doc.id === activeDocumentId) {
                return updateFn(doc)
            }
            return doc
        }))
    }, [activeDocumentId])

    // --- History Logic (Mental Model: useHistory but manual) ---

    const undo = useCallback(() => {
        updateActiveDocument(doc => {
            const { past, present, future } = doc.history
            if (past.length === 0) return doc
            const previous = past[past.length - 1]
            const newPast = past.slice(0, past.length - 1)
            return {
                ...doc,
                history: {
                    past: newPast,
                    present: previous,
                    future: [present, ...future]
                }
            }
        })
    }, [updateActiveDocument])

    const redo = useCallback(() => {
        updateActiveDocument(doc => {
            const { past, present, future } = doc.history
            if (future.length === 0) return doc
            const next = future[0]
            const newFuture = future.slice(1)
            return {
                ...doc,
                history: {
                    past: [...past, present],
                    present: next,
                    future: newFuture
                }
            }
        })
    }, [updateActiveDocument])

    const canUndo = activeDocument ? activeDocument.history.past.length > 0 : false
    const canRedo = activeDocument ? activeDocument.history.future.length > 0 : false

// Load max history entries from localStorage or use default
const getMaxHistoryEntries = (): number => {
    try {
        const stored = localStorage.getItem('shrimp_preferences');
        if (stored) {
            const prefs = JSON.parse(stored);
            if (prefs.undoLevels && typeof prefs.undoLevels === 'number') {
                return Math.max(1, prefs.undoLevels); // At least 1 entry
            }
        }
    } catch {
        // Ignore errors, use default
    }
    return 50; // Default
};

// Generic state update for active document
// historyMode: 'push' (default) | 'replace'
const modifyContent = useCallback((
    updates: Partial<EditorContent> | ((prev: EditorContent) => Partial<EditorContent>),
    historyMode: 'push' | 'replace' = 'push'
) => {
    const maxHistory = getMaxHistoryEntries();
    
    updateActiveDocument(doc => {
        const current = doc.history.present
        const changes = typeof updates === 'function' ? updates(current) : updates
        const newContent = { ...current, ...changes }

        // If no change, return original doc (optimization)
        // (Deep equality check is expensive, so likely just shallow check or rely on updates occurring)

        if (historyMode === 'replace') {
            return {
                ...doc,
                history: {
                    ...doc.history,
                    present: newContent
                }
            }
        } else {
            // Limit history entries to prevent unbounded memory growth
            const newPast = [...doc.history.past, current].slice(-maxHistory);
            return {
                ...doc,
                history: {
                    past: newPast,
                    present: newContent,
                    future: [] // clearer future on new action
                }
            }
        }
    })
}, [updateActiveDocument])

    // Helper to replace "setHistoryState" and "replaceHistoryState"
    // setHistoryState -> modifyContent(..., 'push')
    // replaceHistoryState -> modifyContent(..., 'replace')

    const updateState = useCallback((updates: Partial<EditorContent> | ((prev: EditorContent) => Partial<EditorContent>)) => modifyContent(updates, 'push'), [modifyContent])
    const replaceState = useCallback((updates: Partial<EditorContent> | ((prev: EditorContent) => Partial<EditorContent>)) => modifyContent(updates, 'replace'), [modifyContent])


    const activePath = useMemo(
        () => (activePathId ? paths.find((path) => path.id === activePathId) ?? null : null),
        [paths, activePathId]
    )
    const [activePathNodeId, setActivePathNodeId] = useState<string | null>(null)
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])
    const [cloneSource, setCloneSource] = useState<{ x: number, y: number } | null>(null)

    // Channels
    const [activeChannels, setActiveChannelsState] = useState<ChannelType[]>(['r', 'g', 'b'])

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

    // Generative Fill modal visibility
    const [genFillModalOpen, setGenFillModalOpen] = useState(false)

    // Content-Aware Fill modal visibility
    const [cafModalOpen, setCAFModalOpen] = useState(false)

    // Clipboard state (not persisted)
    const [clipboard, setClipboard] = useState<ClipboardData | null>(null)

    const [cursorInfo, setCursorInfo] = useState<{ x: number, y: number, color: string | null }>({ x: 0, y: 0, color: null })
    const [viewTransform, setViewTransform] = useState<{ scale: number, offsetX: number, offsetY: number }>({ scale: 1, offsetX: 0, offsetY: 0 })
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
    const [histogramData, setHistogramData] = useState<HistogramData | null>(null)

    // Brush Engine State
    const brushEngine = useMemo(() => new BrushEngine(), [])
    const [availableBrushes, setAvailableBrushes] = useState<BrushPreset[]>([])
    const [activeBrushId, setActiveBrushId] = useState<string | null>(null)

    // Initialize Brush Engine
    useEffect(() => {
        brushEngine.init().catch(console.error)
    }, [brushEngine])

    // Update engine when active brush changes
    useEffect(() => {
        if (activeBrushId) {
            const brush = availableBrushes.find(b => b.id === activeBrushId)
            if (brush) {
                brushEngine.configureBrush(brush.settings)
            }
        }
    }, [activeBrushId, availableBrushes, brushEngine])

    // Gradients State
    const [availableGradients, setAvailableGradients] = useState<GradientResource[]>([])
    const [activeGradient, setActiveGradient] = useState<GradientResource | null>(null)

    // Load default gradients (or saved ones later)
    // For now, we can perhaps add a default simple one or just leave empty? 
    // Let's add FG-BG conceptual support later.

    // Import Gradient Action
    const importGradient = useCallback(async (file: File) => {
        try {
            const text = await file.text()
            const gradient = GGRParser.parse(text, Math.random().toString(36).substr(2, 9))
            // Use filename as name if not found? Parser handles name parsing.

            setAvailableGradients(prev => [...prev, gradient])
            setActiveGradient(gradient)
        } catch (e) {
            console.error('Failed to parse gradient:', e)
            alert('Failed to import gradient')
        }
    }, [])

    const importBrush = useCallback(async (blob: Blob, name: string) => {
        // Detect format from header or extension (passed in name or metadata?)
        // For now assume .gbr if unknown
        let format: 'gbr' | 'myb' = 'gbr'
        if (name.endsWith('.myb')) format = 'myb'

        const arrayBuffer = await blob.arrayBuffer()
        // If myb, we might need text
        const data = format === 'myb' ? await blob.text() : arrayBuffer

        const preset = await brushEngine.loadBrush(data, format, name)
        setAvailableBrushes(prev => [...prev, preset])
        setActiveBrushId(preset.id)
    }, [brushEngine])

    useEffect(() => {
        if (!activePath) {
            setActivePathNodeId(null)
            return
        }
    }, [activePath, activePathNodeId])
    const restoreHistoryIndex = useCallback((targetIndex: number) => {
        // Implement history jumping by replacing the state
        // This is complex because we need to move items between past/future
        setDocuments(prevDocs => {
            if (!activeDocumentId) return prevDocs
            return prevDocs.map(doc => {
                if (doc.id !== activeDocumentId) return doc

                const { past, present, future } = doc.history
                const all = [...past, present, ...future]

                if (targetIndex < 0 || targetIndex >= all.length) return doc

                const newPresent = all[targetIndex]
                const newPast = all.slice(0, targetIndex)
                const newFuture = all.slice(targetIndex + 1)

                return {
                    ...doc,
                    history: {
                        past: newPast,
                        present: newPresent,
                        future: newFuture
                    },
                    isDirty: true
                }
            })
        })
    }, [activeDocumentId])



    // --- Document Actions ---

    const addDocument = useCallback((initialContent?: Partial<EditorContent>, name?: string) => {
        // Check if we should replace the initial empty document
        // We use 'documents' in dependency, so we can access it directly
        if (documents.length === 1) {
            const existing = documents[0]
            const isEmpty = existing.history.present.layers.length === 0 &&
                existing.history.past.length === 0 &&
                existing.name.startsWith('Untitled')

            if (isEmpty) {
                const docName = name || existing.name
                const newDoc = createDocument(docName, { ...createInitialContent(), ...initialContent })

                setDocuments([newDoc])
                setActiveDocumentId(newDoc.id)
                return
            }
        }

        const docName = name || `Untitled-${documents.length + 1}`
        const newDoc = createDocument(docName, { ...createInitialContent(), ...initialContent })

        setDocuments(prev => [...prev, newDoc])
        setActiveDocumentId(newDoc.id)
    }, [documents])

    const loadDocument = useCallback((content: EditorContent, name: string) => {
        const newDoc = createDocument(name, content)
        setDocuments(prev => [...prev, newDoc])
        setActiveDocumentId(newDoc.id)
    }, [])

    // Better closeDocument with synchronized active ID update
    const closeDocument = useCallback((id: string) => {
        setDocuments(prev => {
            const index = prev.findIndex(d => d.id === id)
            if (index === -1) return prev

            const newDocs = prev.filter(d => d.id !== id)

            if (newDocs.length === 0) {
                const newDoc = createDocument('Untitled-1', createInitialContent())
                setActiveDocumentId(newDoc.id)
                return [newDoc]
            }

            if (activeDocumentId === id) {
                // Activate the one to the right, or left if last
                const newActiveIndex = Math.min(index, newDocs.length - 1)
                setActiveDocumentId(newDocs[newActiveIndex].id)
            }

            return newDocs
        })
    }, [activeDocumentId])

    // --- State Update Helpers (Document Aware) ---



    const historyEntries = useMemo<HistoryEntry[]>(() => {
        if (!activeDocument) return []
        const { past, present, future } = activeDocument.history
        const snapshots = [...past, present, ...future]
        const currentIndex = past.length

        const flattenLayers = (list: Layer[]): Layer[] => {
            const out: Layer[] = []
            const walk = (layersToWalk: Layer[]) => {
                for (const layer of layersToWalk) {
                    out.push(layer)
                    if (layer.children?.length) walk(layer.children)
                }
            }
            walk(list)
            return out
        }

        const countLayers = (list: Layer[]): number => {
            let count = 0
            for (const layer of list) {
                count++
                if (layer.children?.length) count += countLayers(layer.children)
            }
            return count
        }

        const labelFor = (prev: EditorContent | null, next: EditorContent): string => {
            if (!prev) return 'Initial state'

            if (
                prev.canvasSize.width !== next.canvasSize.width ||
                prev.canvasSize.height !== next.canvasSize.height
            ) {
                return `Crop (${next.canvasSize.width}x${next.canvasSize.height})`
            }

            const prevFlatLayers = flattenLayers(prev.layers)
            const nextFlatLayers = flattenLayers(next.layers)
            const prevLayerMap = new Map(prevFlatLayers.map((l) => [l.id, l]))
            const nextLayerMap = new Map(nextFlatLayers.map((l) => [l.id, l]))

            const prevLayerCount = countLayers(prev.layers)
            const nextLayerCount = countLayers(next.layers)
            if (nextLayerCount > prevLayerCount) {
                const added = nextFlatLayers.find((l) => !prevLayerMap.has(l.id))
                return added ? `Layer added (${added.name})` : 'Layer added'
            }
            if (nextLayerCount < prevLayerCount) {
                const removed = prevFlatLayers.find((l) => !nextLayerMap.has(l.id))
                return removed ? `Layer deleted (${removed.name})` : 'Layer deleted'
            }

            if (prev.activeLayerId !== next.activeLayerId) {
                const active = next.activeLayerId ? nextLayerMap.get(next.activeLayerId) : null
                return active ? `Active layer changed (${active.name})` : 'Active layer changed'
            }

            if (prev.paths.length !== next.paths.length) {
                return next.paths.length > prev.paths.length ? 'Path created' : 'Path deleted'
            }
            if (prev.activePathId !== next.activePathId) {
                return 'Active path changed'
            }
            if (prev.paths !== next.paths) {
                const prevMap = new Map(prev.paths.map((path) => [path.id, path]))
                for (const nextPath of next.paths) {
                    const prevPath = prevMap.get(nextPath.id)
                    if (!prevPath) continue
                    if (prevPath.name !== nextPath.name) return 'Path renamed'
                    if (prevPath.visible !== nextPath.visible) return nextPath.visible ? 'Path shown' : 'Path hidden'
                    if (prevPath.locked !== nextPath.locked) return nextPath.locked ? 'Path locked' : 'Path unlocked'
                    if (prevPath.closed !== nextPath.closed) return nextPath.closed ? 'Path closed' : 'Path opened'
                    if (prevPath.nodes.length !== nextPath.nodes.length) {
                        return nextPath.nodes.length > prevPath.nodes.length
                            ? `Path point added (${nextPath.nodes.length} pts)`
                            : `Path point removed (${nextPath.nodes.length} pts)`
                    }
                    if (prevPath !== nextPath) return 'Path edited'
                }
            }

            if (!prev.selection && next.selection) return `Selection created (${next.selection.type})`
            if (prev.selection && !next.selection) return 'Selection cleared'
            if (prev.selection !== next.selection) {
                return next.selection ? `Selection updated (${next.selection.type})` : 'Selection updated'
            }

            if (prev.guides.length !== next.guides.length) {
                return next.guides.length > prev.guides.length
                    ? `Guide added (${next.guides.length})`
                    : `Guide removed (${next.guides.length})`
            }
            if (prev.guides !== next.guides) return 'Guide updated'

            if (prev.layers !== next.layers) {
                const changedLayerIds = new Set<string>()
                for (const nextLayer of nextFlatLayers) {
                    const prevLayer = prevLayerMap.get(nextLayer.id)
                    if (!prevLayer) continue
                    if (prevLayer !== nextLayer) changedLayerIds.add(nextLayer.id)
                }

                if (changedLayerIds.size === 1) {
                    const changedId = [...changedLayerIds][0]
                    const prevLayer = prevLayerMap.get(changedId)
                    const nextLayer = nextLayerMap.get(changedId)
                    if (prevLayer && nextLayer) {
                        const nonDataChanged =
                            prevLayer.name !== nextLayer.name ||
                            prevLayer.visible !== nextLayer.visible ||
                            prevLayer.locked !== nextLayer.locked ||
                            prevLayer.opacity !== nextLayer.opacity ||
                            prevLayer.blendMode !== nextLayer.blendMode ||
                            prevLayer.x !== nextLayer.x ||
                            prevLayer.y !== nextLayer.y ||
                            prevLayer.type !== nextLayer.type ||
                            prevLayer.expanded !== nextLayer.expanded ||
                            prevLayer.text !== nextLayer.text ||
                            prevLayer.textStyle !== nextLayer.textStyle ||
                            prevLayer.children !== nextLayer.children ||
                            prevLayer.filters !== nextLayer.filters

                        if (!nonDataChanged && prevLayer.data !== nextLayer.data) {
                            return `Paint stroke (${nextLayer.name})`
                        }
                    }
                }

                if (next.activeLayerId) {
                    const active = nextLayerMap.get(next.activeLayerId)
                    if (active) return `Layer content updated (${active.name})`
                }
                return 'Layer content updated'
            }
            return 'State updated'
        }

        return snapshots.map((snapshot, index) => ({
            index,
            label: labelFor(index > 0 ? snapshots[index - 1] : null, snapshot),
            isCurrent: index === currentIndex
        }))
    }, [activeDocument])

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

    const addTextLayer = useCallback((text: string, style: NonNullable<Layer['textStyle']>, x: number, y: number) => {
        let newLayerId = ''
        updateState((prevState) => {
            const newLayer: Layer = {
                id: Math.random().toString(36).substr(2, 9),
                name: 'T ' + (text.substring(0, 20) || 'Text Layer'),
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

    const updateLayerPosition = useCallback((id: string, x: number, y: number, history: boolean = true) => {
        const updater = (prevState: EditorContent) => ({
            layers: updateLayerInTree(prevState.layers, id, { x, y })
        })
        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    // Force texture update without adding to history - used by brush tool for real-time preview
    const refreshLayerRender = useCallback((id: string) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, id)
            if (!layer) return {}
            const newVersion = (layer.renderVersion || 0) + 1
            return {
                layers: updateLayerInTree(prevState.layers, id, { renderVersion: newVersion })
            }
        }
        replaceState(updater)
    }, [replaceState])

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

    const updateLayerData = useCallback((id: string, canvas: HTMLCanvasElement, history: boolean = true) => {
        const updater = (prevState: EditorContent) => ({
            layers: updateLayerInTree(prevState.layers, id, { data: canvas })
        })
        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    const updateLayerText = useCallback((id: string, text: string) => {
        updateState(prevState => ({
            layers: updateLayerInTree(prevState.layers, id, { text, name: 'T ' + (text.substring(0, 20) || 'Text Layer') })
        }))
    }, [updateState])

    const updateLayerTextStyle = useCallback((id: string, style: Partial<NonNullable<Layer['textStyle']>>, history: boolean = true) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, id)
            if (!layer || layer.type !== 'text') return {}
            const newStyle = { ...layer.textStyle, ...style } as any
            return {
                layers: updateLayerInTree(prevState.layers, id, { textStyle: newStyle })
            }
        }
        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    const addFilter = useCallback((layerId: string, filter: LayerFilter) => {
        updateState(prevState => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            return {
                layers: updateLayerInTree(prevState.layers, layerId, { filters: [...layer.filters, filter] })
            }
        })
    }, [updateState])

    const setLayerFilters = useCallback((layerId: string, filters: LayerFilter[], history: boolean = true) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer) return {}
            return {
                layers: updateLayerInTree(prevState.layers, layerId, {
                    filters: filters.map((filter) => ({
                        ...filter,
                        params: { ...filter.params }
                    }))
                })
            }
        }

        if (history) {
            updateState(updater)
            return
        }
        replaceState(updater)
    }, [replaceState, updateState])

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

    // --- Path Actions ---

    const nextPathName = useCallback((existingPaths: VectorPath[], baseName: string = 'Path') => {
        const names = new Set(existingPaths.map((path) => path.name))
        if (!names.has(baseName)) return baseName
        let i = 2
        while (names.has(`${baseName} ${i}`)) i++
        return `${baseName} ${i}`
    }, [])

    const createPath = useCallback((name?: string) => {
        let createdId = ''
        updateState((prevState) => {
            const nextName = name?.trim() || nextPathName(prevState.paths)
            const created = createVectorPath(nextName)
            createdId = created.id
            return {
                paths: [created, ...prevState.paths],
                activePathId: created.id
            }
        })
        return createdId
    }, [updateState, nextPathName])

    const setActivePathId = useCallback((id: string | null) => {
        updateState({ activePathId: id })
    }, [updateState])

    const updatePath = useCallback((pathId: string, updater: (path: VectorPath) => VectorPath, history: boolean = true) => {
        const apply = (prevState: EditorContent) => {
            const index = prevState.paths.findIndex((path) => path.id === pathId)
            if (index < 0) return {}

            const current = prevState.paths[index]
            const updated = updater(current)
            if (updated === current) return {}

            const nextPaths = [...prevState.paths]
            nextPaths[index] = { ...updated, updatedAt: Date.now() }
            return { paths: nextPaths }
        }

        if (history) updateState(apply)
        else replaceState(apply)
    }, [updateState, replaceState])

    const renamePath = useCallback((pathId: string, name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return
        updatePath(pathId, (path) => ({ ...path, name: trimmed }))
    }, [updatePath])

    const duplicatePath = useCallback((pathId: string) => {
        let duplicatedId: string | null = null
        updateState((prevState) => {
            const path = prevState.paths.find((candidate) => candidate.id === pathId)
            if (!path) return {}

            const duplicated = duplicateVectorPath(path, nextPathName(prevState.paths, `${path.name} Copy`))
            duplicatedId = duplicated.id
            return {
                paths: [duplicated, ...prevState.paths],
                activePathId: duplicated.id
            }
        })
        return duplicatedId
    }, [updateState, nextPathName])

    const deletePath = useCallback((pathId: string) => {
        updateState((prevState) => {
            const nextPaths = prevState.paths.filter((path) => path.id !== pathId)
            if (nextPaths.length === prevState.paths.length) return {}
            const nextActivePathId = prevState.activePathId === pathId ? (nextPaths[0]?.id ?? null) : prevState.activePathId
            return {
                paths: nextPaths,
                activePathId: nextActivePathId
            }
        })
    }, [updateState])

    const setPathVisibility = useCallback((pathId: string, visible: boolean) => {
        updatePath(pathId, (path) => ({ ...path, visible }))
    }, [updatePath])

    const setPathLocked = useCallback((pathId: string, locked: boolean) => {
        updatePath(pathId, (path) => ({ ...path, locked }))
    }, [updatePath])

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

    // --- Shape Layer Actions ---

    /**
     * Create a new shape layer
     */
    const addShapeLayer = useCallback((name: string = 'Shape Layer'): string => {
        let newLayerId = ''
        updateState((prevState) => {
            const newLayer: Layer = {
                id: Math.random().toString(36).substr(2, 9),
                name,
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: 'normal',
                data: null,
                filters: [],
                x: 0,
                y: 0,
                type: 'shape',
                shapeData: createShapeLayerData(),
            }
            newLayerId = newLayer.id
            return {
                layers: [newLayer, ...prevState.layers],
                activeLayerId: newLayer.id,
            }
        })
        return newLayerId
    }, [updateState])

    /**
     * Add a shape to an existing shape layer
     */
    const addShapeToLayer = useCallback((
        layerId: string,
        shapeType: ShapePrimitiveType,
        params: {
            x: number
            y: number
            width: number
            height: number
            cornerRadius?: number
            sides?: number
            fill?: Partial<ShapeFill>
            stroke?: Partial<ShapeStroke>
        }
    ): string | null => {
        let shapeId: string | null = null
        
        updateState((prevState) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            // Create the appropriate path based on shape type
            let path
            switch (shapeType) {
                case 'rect':
                    path = createRectPath(params.x, params.y, params.width, params.height, params.cornerRadius ?? 0)
                    break
                case 'ellipse':
                    const cx = params.x + params.width / 2
                    const cy = params.y + params.height / 2
                    path = createEllipsePath(cx, cy, params.width / 2, params.height / 2)
                    break
                case 'polygon':
                    const pcx = params.x + params.width / 2
                    const pcy = params.y + params.height / 2
                    const radius = Math.min(params.width, params.height) / 2
                    path = createPolygonPath(pcx, pcy, radius, params.sides ?? 5)
                    break
                case 'line':
                    path = createLinePath(params.x, params.y, params.x + params.width, params.y + params.height)
                    break
                default:
                    return {}
            }

            const shape = createVectorShape({
                type: shapeType,
                path,
                fill: params.fill ? { ...DEFAULT_SHAPE_FILL, ...params.fill } : undefined,
                stroke: params.stroke ? { ...DEFAULT_SHAPE_STROKE, ...params.stroke } : undefined,
            })
            
            shapeId = shape.id

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: [...layer.shapeData.shapes, shape],
                activeShapeId: shape.id,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        })

        return shapeId
    }, [updateState])

    /**
     * Update a shape within a shape layer
     */
    const updateShape = useCallback((
        layerId: string,
        shapeId: string,
        updates: Partial<VectorShape>,
        history: boolean = true
    ) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const shapeIndex = layer.shapeData.shapes.findIndex(s => s.id === shapeId)
            if (shapeIndex < 0) return {}

            const updatedShapes = [...layer.shapeData.shapes]
            updatedShapes[shapeIndex] = {
                ...updatedShapes[shapeIndex],
                ...updates,
                updatedAt: Date.now(),
            }

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: updatedShapes,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        }

        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    /**
     * Delete a shape from a shape layer
     */
    const deleteShape = useCallback((layerId: string, shapeId: string) => {
        updateState((prevState) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const newShapes = layer.shapeData.shapes.filter(s => s.id !== shapeId)
            if (newShapes.length === layer.shapeData.shapes.length) return {}

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: newShapes,
                activeShapeId: layer.shapeData.activeShapeId === shapeId 
                    ? (newShapes[0]?.id ?? null) 
                    : layer.shapeData.activeShapeId,
                selectedShapeIds: layer.shapeData.selectedShapeIds.filter(id => id !== shapeId),
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        })
    }, [updateState])

    /**
     * Set the active shape in a shape layer
     */
    const setActiveShape = useCallback((layerId: string, shapeId: string | null) => {
        updateState((prevState) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                activeShapeId: shapeId,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        })
    }, [updateState])

    /**
     * Duplicate a shape within a shape layer
     */
    const duplicateShape = useCallback((layerId: string, shapeId: string): string | null => {
        let newShapeId: string | null = null
        
        updateState((prevState) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const shape = layer.shapeData.shapes.find(s => s.id === shapeId)
            if (!shape) return {}

            const duplicated = cloneShape(shape)
            newShapeId = duplicated.id

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: [...layer.shapeData.shapes, duplicated],
                activeShapeId: duplicated.id,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        })

        return newShapeId
    }, [updateState])

    /**
     * Update shape fill
     */
    const updateShapeFill = useCallback((
        layerId: string,
        shapeId: string,
        fill: Partial<ShapeFill>,
        history: boolean = true
    ) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const shapeIndex = layer.shapeData.shapes.findIndex(s => s.id === shapeId)
            if (shapeIndex < 0) return {}

            const updatedShapes = [...layer.shapeData.shapes]
            updatedShapes[shapeIndex] = {
                ...updatedShapes[shapeIndex],
                fill: { ...updatedShapes[shapeIndex].fill, ...fill },
                updatedAt: Date.now(),
            }

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: updatedShapes,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        }

        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    /**
     * Update shape stroke
     */
    const updateShapeStroke = useCallback((
        layerId: string,
        shapeId: string,
        stroke: Partial<ShapeStroke>,
        history: boolean = true
    ) => {
        const updater = (prevState: EditorContent) => {
            const layer = findLayerById(prevState.layers, layerId)
            if (!layer || layer.type !== 'shape' || !layer.shapeData) return {}

            const shapeIndex = layer.shapeData.shapes.findIndex(s => s.id === shapeId)
            if (shapeIndex < 0) return {}

            const updatedShapes = [...layer.shapeData.shapes]
            updatedShapes[shapeIndex] = {
                ...updatedShapes[shapeIndex],
                stroke: { ...updatedShapes[shapeIndex].stroke, ...stroke },
                updatedAt: Date.now(),
            }

            const newShapeData: ShapeLayerData = {
                ...layer.shapeData,
                shapes: updatedShapes,
            }

            return {
                layers: updateLayerInTree(prevState.layers, layerId, { shapeData: newShapeData }),
            }
        }

        if (history) updateState(updater)
        else replaceState(updater)
    }, [updateState, replaceState])

    /**
     * Render shape layer to a canvas (for display/export)
     */
    const renderShapeLayerToCanvas = useCallback((layerId: string): HTMLCanvasElement | null => {
        const layer = findLayerById(layers, layerId)
        if (!layer || layer.type !== 'shape' || !layer.shapeData) return null

        return renderShapeLayer(layer.shapeData.shapes, canvasSize.width, canvasSize.height)
    }, [layers, canvasSize])

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

    // closeImage removed (duplicate)

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

    // --- Copy/Paste Actions ---
    

    // Copy selection to clipboard
    // merged: false = copy active layer only, true = copy merged (all visible layers)
    const copySelection = useCallback((merged: boolean = false) => {
        if (!activeLayerId && !merged) return
        
        // Determine bounds
        let bounds = selection
        if (!bounds) {
            // No selection, copy entire canvas
            bounds = {
                type: 'rect',
                x: 0,
                y: 0,
                width: canvasSize.width,
                height: canvasSize.height
            }
        }

        // Create a canvas for the copied content
        const copyCanvas = document.createElement('canvas')
        copyCanvas.width = Math.max(1, Math.abs(bounds.width))
        copyCanvas.height = Math.max(1, Math.abs(bounds.height))
        const copyCtx = copyCanvas.getContext('2d')
        if (!copyCtx) return

        // Normalize bounds for negative width/height
        const bx = bounds.width < 0 ? bounds.x + bounds.width : bounds.x
        const by = bounds.height < 0 ? bounds.y + bounds.height : bounds.y
        const bw = Math.abs(bounds.width)
        const bh = Math.abs(bounds.height)

        if (merged) {
            // Copy merged - flatten all visible layers
            const collectVisible = (list: Layer[]): Layer[] => {
                const result: Layer[] = []
                for (const l of list) {
                    if (!l.visible) continue
                    if (l.type === 'group' && l.children) {
                        result.push(...collectVisible(l.children))
                    } else if (l.data || l.type === 'text') {
                        result.push(l)
                    }
                }
                return result
            }

            const visibleLayers = collectVisible(layers).reverse()

            // Create temp canvas for merged content
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = canvasSize.width
            tempCanvas.height = canvasSize.height
            const tempCtx = tempCanvas.getContext('2d')
            if (!tempCtx) return

            for (const layer of visibleLayers) {
                tempCtx.globalAlpha = layer.opacity / 100
                tempCtx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation) || 'source-over'
                if (layer.type === 'text') {
                    renderTextLayerToCanvas(tempCtx, layer)
                } else if (layer.data) {
                    tempCtx.drawImage(layer.data, layer.x, layer.y)
                }
            }

            // Copy the selection region
            if (selection) {
                // Create a mask for non-rect selections
                if (selection.type !== 'rect') {
                    copyCtx.save()
                    copyCtx.beginPath()
                    if (selection.type === 'ellipse') {
                        const cx = selection.x + selection.width / 2 - bx
                        const cy = selection.y + selection.height / 2 - by
                        copyCtx.ellipse(cx, cy, Math.abs(selection.width / 2), Math.abs(selection.height / 2), 0, 0, Math.PI * 2)
                    } else if (selection.path) {
                        copyCtx.moveTo(selection.path[0].x - bx, selection.path[0].y - by)
                        for (let i = 1; i < selection.path.length; i++) {
                            copyCtx.lineTo(selection.path[i].x - bx, selection.path[i].y - by)
                        }
                        copyCtx.closePath()
                    }
                    copyCtx.clip()
                }
                copyCtx.drawImage(tempCanvas, bx, by, bw, bh, 0, 0, bw, bh)
                if (selection && selection.type !== 'rect') {
                    copyCtx.restore()
                }
            } else {
                copyCtx.drawImage(tempCanvas, bx, by, bw, bh, 0, 0, bw, bh)
            }
        } else {
            // Copy active layer only
            const layer = findLayerById(layers, activeLayerId!)
            if (!layer) return

            if (layer.type === 'text') {
                // Render text layer to temp canvas first
                const tempCanvas = document.createElement('canvas')
                tempCanvas.width = canvasSize.width
                tempCanvas.height = canvasSize.height
                const tempCtx = tempCanvas.getContext('2d')
                if (tempCtx) {
                    renderTextLayerToCanvas(tempCtx, layer)
                    
                    if (selection && selection.type !== 'rect') {
                        copyCtx.save()
                        copyCtx.beginPath()
                        if (selection.type === 'ellipse') {
                            const cx = selection.x + selection.width / 2 - bx
                            const cy = selection.y + selection.height / 2 - by
                            copyCtx.ellipse(cx, cy, Math.abs(selection.width / 2), Math.abs(selection.height / 2), 0, 0, Math.PI * 2)
                        } else if (selection.path) {
                            copyCtx.moveTo(selection.path[0].x - bx, selection.path[0].y - by)
                            for (let i = 1; i < selection.path.length; i++) {
                                copyCtx.lineTo(selection.path[i].x - bx, selection.path[i].y - by)
                            }
                            copyCtx.closePath()
                        }
                        copyCtx.clip()
                    }
                    copyCtx.drawImage(tempCanvas, bx, by, bw, bh, 0, 0, bw, bh)
                    if (selection && selection.type !== 'rect') {
                        copyCtx.restore()
                    }
                }
            } else if (layer.data) {
                // Apply selection mask if not rectangular
                if (selection && selection.type !== 'rect') {
                    copyCtx.save()
                    copyCtx.beginPath()
                    if (selection.type === 'ellipse') {
                        const cx = selection.x + selection.width / 2 - bx
                        const cy = selection.y + selection.height / 2 - by
                        copyCtx.ellipse(cx, cy, Math.abs(selection.width / 2), Math.abs(selection.height / 2), 0, 0, Math.PI * 2)
                    } else if (selection.path) {
                        copyCtx.moveTo(selection.path[0].x - bx, selection.path[0].y - by)
                        for (let i = 1; i < selection.path.length; i++) {
                            copyCtx.lineTo(selection.path[i].x - bx, selection.path[i].y - by)
                        }
                        copyCtx.closePath()
                    }
                    copyCtx.clip()
                }

                // Draw the layer content offset by layer position
                copyCtx.drawImage(layer.data, layer.x - bx, layer.y - by)

                if (selection && selection.type !== 'rect') {
                    copyCtx.restore()
                }
            }
        }

        setClipboard({
            canvas: copyCanvas,
            x: bx,
            y: by
        })
    }, [activeLayerId, selection, canvasSize, layers])

    // Paste clipboard content as a new layer
    const pasteSelection = useCallback(() => {
        if (!clipboard) return

        // Create a new layer from clipboard
        const newCanvas = document.createElement('canvas')
        newCanvas.width = clipboard.canvas.width
        newCanvas.height = clipboard.canvas.height
        const ctx = newCanvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(clipboard.canvas, 0, 0)

        // Add as new layer at the original position
        const layerId = addLayer('Pasted Layer', newCanvas)
        
        // Update position to where it was copied from
        updateLayerPosition(layerId, clipboard.x, clipboard.y, true)
    }, [clipboard, addLayer, updateLayerPosition])

    // Helper: render a text layer to a 2D canvas context
    const renderTextLayerToCanvas = (ctx: CanvasRenderingContext2D, layer: Layer) => {
        if (layer.type !== 'text' || !layer.text) return
        const s = layer.textStyle || { fontFamily: 'Arial', fontSize: 24, fill: '#000000' }
        const weight = s.fontWeight || 'normal'
        const style = s.fontStyle || 'normal'
        ctx.font = `${style} ${weight} ${s.fontSize}px "${s.fontFamily}"`
        ctx.fillStyle = s.fill
        ctx.textBaseline = 'top'

        const lines = layer.text.split('\n')
        const lineH = s.fontSize * (s.lineHeight || 1.2)
        const letterSp = s.letterSpacing || 0

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            let drawX = layer.x

            // Alignment
            if (s.align && s.align !== 'left' && s.wordWrapWidth) {
                const metrics = ctx.measureText(line)
                const lineW = metrics.width + letterSp * (line.length - 1)
                if (s.align === 'center') drawX = layer.x + (s.wordWrapWidth - lineW) / 2
                else if (s.align === 'right') drawX = layer.x + s.wordWrapWidth - lineW
            }

            const drawY = layer.y + i * lineH

            if (letterSp && letterSp !== 0) {
                // Draw character by character for letter spacing
                let cx = drawX
                for (const ch of line) {
                    ctx.fillText(ch, cx, drawY)
                    cx += ctx.measureText(ch).width + letterSp
                }
            } else {
                ctx.fillText(line, drawX, drawY)
            }

            // Decorations
            const dec = s.textDecoration || 'none'
            if (dec === 'underline' || dec === 'line-through') {
                const metrics = ctx.measureText(line)
                const lineW = letterSp ? (metrics.width + letterSp * (line.length - 1)) : metrics.width
                ctx.strokeStyle = s.fill
                ctx.lineWidth = Math.max(1, s.fontSize / 16)
                ctx.beginPath()
                const yOff = dec === 'underline' ? drawY + s.fontSize * 0.95 : drawY + s.fontSize * 0.45
                ctx.moveTo(drawX, yOff)
                ctx.lineTo(drawX + lineW, yOff)
                ctx.stroke()
            }
        }
    }

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
                    } else if (l.data || l.type === 'text') {
                        result.push(l)
                    }
                }
                return result
            }

            const visibleLayers = collectVisible(prevState.layers).reverse()

            for (const layer of visibleLayers) {
                ctx.globalAlpha = layer.opacity / 100
                ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation) || 'source-over'
                if (layer.type === 'text') {
                    renderTextLayerToCanvas(ctx, layer)
                } else if (layer.data) {
                    ctx.drawImage(layer.data, layer.x, layer.y)
                }
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
            if ((!upper.data && upper.type !== 'text') || (!lower.data && lower.type !== 'text')) return {}

            const mergedCanvas = document.createElement('canvas')
            mergedCanvas.width = prevState.canvasSize.width
            mergedCanvas.height = prevState.canvasSize.height
            const ctx = mergedCanvas.getContext('2d')
            if (!ctx) return {}

            ctx.globalAlpha = lower.opacity / 100
            if (lower.type === 'text') renderTextLayerToCanvas(ctx, lower)
            else if (lower.data) ctx.drawImage(lower.data, lower.x, lower.y)
            ctx.globalAlpha = upper.opacity / 100
            if (upper.type === 'text') renderTextLayerToCanvas(ctx, upper)
            else if (upper.data) ctx.drawImage(upper.data, upper.x, upper.y)
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
                } else if (l.data || l.type === 'text') {
                    result.push(l)
                }
            }
            return result
        }

        const visibleLayers = collectVisible(layers).reverse()

        for (const layer of visibleLayers) {
            ctx.globalAlpha = layer.opacity / 100
            if (layer.type === 'text') {
                renderTextLayerToCanvas(ctx, layer)
            } else if (layer.data) {
                ctx.drawImage(layer.data, layer.x, layer.y)
            }
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

        const content: EditorContent = {
            layers: [layer],
            activeLayerId: layer.id,
            canvasSize: { width, height },
            selection: null,
            guides: [],
            paths: [],
            activePathId: null
        }

        addDocument(content)
    }, [addDocument])

    const openImage = useCallback((name: string, canvas: HTMLCanvasElement) => {
        const layer: Layer = {
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

        const content: EditorContent = {
            layers: [layer],
            activeLayerId: layer.id,
            canvasSize: { width: canvas.width, height: canvas.height },
            selection: null,
            guides: [],
            paths: [],
            activePathId: null
        }

        addDocument(content, name)
    }, [addDocument])

    const closeImage = useCallback(() => {
        if (activeDocumentId) {
            closeDocument(activeDocumentId)
        }
    }, [activeDocumentId, closeDocument])

    // Explicit add to history for components that manipulate state externally?
    // Not really needed since we use the setters above.
    const addToHistory = useCallback(() => {
        // No-op if we use the setters above
    }, [])

    const toggleChannel = useCallback((channel: ChannelType) => {
        setActiveChannelsState(prev => {
            if (prev.includes(channel)) {
                // Don't allow empty channels? Or do? 
                // Usually allowed, results in black screen or transparency.
                return prev.filter(c => c !== channel)
            }
            return [...prev, channel]
        })
    }, [])

    const setActiveChannels = useCallback((channels: ChannelType[]) => {
        setActiveChannelsState(channels)
    }, [])

    return (
        <EditorContext.Provider value={{
            documents,
            activeDocumentId,
            activeDocument,
            addDocument,
            loadDocument,
            closeDocument,
            setActiveDocumentId,
            layers,
            activeLayerId,
            canvasSize,
            selection,
            paths,
            activePathId,
            activePath,
            activePathNodeId,
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
            refreshLayerRender,
            updateLayerText,
            addFilter,
            setLayerFilters,
            removeFilter,
            setSelection: setSelectionWrapper,
            reorderLayers,
            // Selection actions
            selectAll,
            selectNone,
            invertSelection,
            // Copy/Paste actions
            copySelection,
            pasteSelection,
            // Image actions
            flattenImage,
            mergeDown,
            exportImage,
            newImage,
            openImage,
            // History
            closeImage,
            undo,
            redo,
            canUndo,
            canRedo,
            historyEntries,
            historyCurrentIndex: activeDocument?.history.past.length ?? 0,
            restoreHistoryIndex,
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
            // Phase 3: Brush Engine
            brushEngine,
            availableBrushes,
            activeBrushId,
            setActiveBrushId,
            importBrush,
            toggleFilter,
            updateLayerTextStyle,

            // Path Tool
            createPath,
            setActivePathId,
            updatePath,
            renamePath,
            duplicatePath,
            deletePath,
            setPathVisibility,
            setPathLocked,
            setActivePathNodeId,

            // Cursor Info
            cursorInfo,
            setCursorInfo,

            // View Transform
            viewTransform,
            setViewTransform,
            viewportSize,
            setViewportSize,
            cloneSource,
            setCloneSource,
            histogramData,
            setHistogramData,
            activeChannels,
            toggleChannel,
            setActiveChannels,

            // Generative Fill modal
            genFillModalOpen,
            setGenFillModalOpen,

            // Content-Aware Fill modal
            cafModalOpen,
            setCAFModalOpen,

            // Gradients
            availableGradients,
            activeGradient,
            setActiveGradient,
            importGradient,

            // Shape Layers
            addShapeLayer,
            addShapeToLayer,
            updateShape,
            deleteShape,
            setActiveShape,
            duplicateShape,
            updateShapeFill,
            updateShapeStroke,
            renderShapeLayerToCanvas,
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
