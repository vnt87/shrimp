/**
 * History Compression Utilities
 * 
 * This module provides memory-efficient compression for canvas data
 * and computes minimal deltas between canvas states.
 */

import type { ImageDiff, LayerDelta, SerializedLayerLight, SerializedEditorContentLight, HistorySnapshot, ChangeType } from '../types/history'
import type { Layer, EditorContent } from '../components/EditorContext'

// ============================================
// Canvas Compression
// ============================================

/**
 * Compress a canvas to a Blob (PNG or WebP)
 * WebP offers better compression but PNG has wider support
 */
export async function compressCanvas(
  canvas: HTMLCanvasElement,
  format: 'webp' | 'png' = 'webp',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = format === 'webp' ? 'image/webp' : 'image/png'
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to compress canvas'))
        }
      },
      mimeType,
      quality
    )
  })
}

/**
 * Decompress a Blob back to a canvas
 */
export async function decompressCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
      }
      URL.revokeObjectURL(img.src)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to decompress canvas'))
    }
    img.src = URL.createObjectURL(blob)
  })
}

// ============================================
// Image Diff Computation
// ============================================

/**
 * Compute the bounding box of changed pixels between two canvases
 * Returns null if canvases are identical or too different
 */
export function computeChangedBounds(
  before: HTMLCanvasElement | null,
  after: HTMLCanvasElement
): { x: number; y: number; width: number; height: number } | null {
  if (!before) {
    // Full canvas is the change
    return { x: 0, y: 0, width: after.width, height: after.height }
  }

  if (before.width !== after.width || before.height !== after.height) {
    // Dimensions changed, need full canvas
    return { x: 0, y: 0, width: after.width, height: after.height }
  }

  const beforeCtx = before.getContext('2d', { willReadFrequently: true })
  const afterCtx = after.getContext('2d', { willReadFrequently: true })
  
  if (!beforeCtx || !afterCtx) {
    return { x: 0, y: 0, width: after.width, height: after.height }
  }

  const width = after.width
  const height = after.height

  // Sample every few pixels for performance on large images
  const sampleStep = width > 1000 || height > 1000 ? 4 : 2
  
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  // Get image data
  const beforeData = beforeCtx.getImageData(0, 0, width, height).data
  const afterData = afterCtx.getImageData(0, 0, width, height).data

  // Find changed region by sampling
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4
      if (
        beforeData[idx] !== afterData[idx] ||
        beforeData[idx + 1] !== afterData[idx + 1] ||
        beforeData[idx + 2] !== afterData[idx + 2] ||
        beforeData[idx + 3] !== afterData[idx + 3]
      ) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  // If no changes found, return null
  if (maxX < 0) {
    return null
  }

  // Expand bounds to cover sampled pixels and add padding
  const padding = 2
  minX = Math.max(0, minX - padding - sampleStep)
  minY = Math.max(0, minY - padding - sampleStep)
  maxX = Math.min(width - 1, maxX + padding + sampleStep)
  maxY = Math.min(height - 1, maxY + padding + sampleStep)

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

/**
 * Compute an image diff between two canvas states
 */
export async function computeImageDiff(
  before: HTMLCanvasElement | null,
  after: HTMLCanvasElement
): Promise<ImageDiff> {
  const bounds = computeChangedBounds(before, after)
  
  if (!bounds) {
    // No change
    return {
      type: 'bbox',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      compressedData: null
    }
  }

  // If the change covers more than 70% of the canvas, store full image
  const totalPixels = after.width * after.height
  const changedPixels = bounds.width * bounds.height
  const useFullImage = changedPixels > totalPixels * 0.7

  let compressedData: Blob
  let x: number, y: number, width: number, height: number

  if (useFullImage) {
    // Store full image
    compressedData = await compressCanvas(after)
    x = 0
    y = 0
    width = after.width
    height = after.height
  } else {
    // Store only the changed region
    const regionCanvas = document.createElement('canvas')
    regionCanvas.width = bounds.width
    regionCanvas.height = bounds.height
    const ctx = regionCanvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(
        after,
        bounds.x, bounds.y, bounds.width, bounds.height,
        0, 0, bounds.width, bounds.height
      )
    }
    compressedData = await compressCanvas(regionCanvas)
    x = bounds.x
    y = bounds.y
    width = bounds.width
    height = bounds.height
  }

  return {
    type: useFullImage ? 'full' : 'bbox',
    x,
    y,
    width,
    height,
    compressedData
  }
}

/**
 * Apply an image diff to a base canvas
 */
export async function applyImageDiff(
  baseCanvas: HTMLCanvasElement | null,
  diff: ImageDiff
): Promise<HTMLCanvasElement> {
  if (!diff.compressedData) {
    // No change, return base or empty canvas
    if (baseCanvas) return baseCanvas
    const empty = document.createElement('canvas')
    empty.width = 1
    empty.height = 1
    return empty
  }

  const decompressed = await decompressCanvas(diff.compressedData)

  if (diff.type === 'full' || !baseCanvas) {
    // Full replacement
    return decompressed
  }

  // Apply region patch
  const result = document.createElement('canvas')
  result.width = baseCanvas.width
  result.height = baseCanvas.height
  const ctx = result.getContext('2d')
  if (ctx) {
    // Copy base
    ctx.drawImage(baseCanvas, 0, 0)
    // Apply patch
    ctx.drawImage(decompressed, diff.x, diff.y)
  }
  return result
}

// ============================================
// Layer Serialization
// ============================================

/**
 * Serialize a layer to lightweight format (without canvas data)
 */
export function serializeLayerLight(layer: Layer): SerializedLayerLight {
  const light: SerializedLayerLight = {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    filters: layer.filters ? [...layer.filters] : [],
    x: layer.x,
    y: layer.y,
    type: layer.type,
    children: layer.children?.map(serializeLayerLight),
    text: layer.text,
    textStyle: layer.textStyle,
    shapeData: layer.shapeData
  }
  return light
}

/**
 * Serialize editor content to lightweight format
 */
export function serializeContentLight(content: EditorContent): SerializedEditorContentLight {
  return {
    layers: content.layers.map(serializeLayerLight),
    activeLayerId: content.activeLayerId,
    canvasSize: { ...content.canvasSize },
    selection: content.selection,
    guides: [...content.guides],
    paths: [...content.paths],
    activePathId: content.activePathId
  }
}

// ============================================
// Layer Delta Computation
// ============================================

/**
 * Compute deltas between two content states
 */
export async function computeContentDeltas(
  before: EditorContent,
  after: EditorContent
): Promise<LayerDelta[]> {
  const deltas: LayerDelta[] = []

  // Create layer maps for comparison
  const beforeLayers = new Map<string, Layer>()
  const afterLayers = new Map<string, Layer>()
  
  const flattenLayers = (layers: Layer[], map: Map<string, Layer>) => {
    for (const layer of layers) {
      map.set(layer.id, layer)
      if (layer.children) {
        flattenLayers(layer.children, map)
      }
    }
  }
  
  flattenLayers(before.layers, beforeLayers)
  flattenLayers(after.layers, afterLayers)

  // Check for deleted layers
  for (const [id, layer] of beforeLayers) {
    if (!afterLayers.has(id)) {
      deltas.push({
        layerId: id,
        changeType: 'deleted',
        fullLayer: layer
      })
    }
  }

  // Check for created/modified layers
  for (const [id, afterLayer] of afterLayers) {
    const beforeLayer = beforeLayers.get(id)
    
    if (!beforeLayer) {
      // New layer
      deltas.push({
        layerId: id,
        changeType: 'created',
        fullLayer: afterLayer
      })
    } else {
      // Check for changes
      const propertyChanges: Partial<Layer> = {}
      let hasPropertyChanges = false

      // Compare properties
      const propsToCheck: (keyof Layer)[] = [
        'name', 'visible', 'locked', 'opacity', 'blendMode', 
        'x', 'y', 'text', 'textStyle', 'shapeData'
      ]
      
      for (const prop of propsToCheck) {
        if (JSON.stringify(beforeLayer[prop]) !== JSON.stringify(afterLayer[prop])) {
          propertyChanges[prop] = afterLayer[prop] as any
          hasPropertyChanges = true
        }
      }

      // Compare filters
      if (JSON.stringify(beforeLayer.filters) !== JSON.stringify(afterLayer.filters)) {
        propertyChanges.filters = afterLayer.filters
        hasPropertyChanges = true
      }

      if (hasPropertyChanges) {
        deltas.push({
          layerId: id,
          changeType: 'properties',
          propertyChanges
        })
      }

      // Compare canvas data
      if (beforeLayer.data && afterLayer.data) {
        const bounds = computeChangedBounds(beforeLayer.data, afterLayer.data)
        if (bounds) {
          const imageDiff = await computeImageDiff(beforeLayer.data, afterLayer.data)
          deltas.push({
            layerId: id,
            changeType: 'data',
            dataDiff: imageDiff
          })
        }
      } else if (!beforeLayer.data && afterLayer.data) {
        // Gained data
        const imageDiff = await computeImageDiff(null, afterLayer.data)
        deltas.push({
          layerId: id,
          changeType: 'data',
          dataDiff: imageDiff
        })
      }
    }
  }

  // Check for layer order changes (simplified - only top-level)
  if (before.layers.length === after.layers.length) {
    for (let i = 0; i < before.layers.length; i++) {
      if (before.layers[i].id !== after.layers[i].id) {
        // Order changed - this is complex to handle properly
        // For now, we'll handle it as property changes
        break
      }
    }
  }

  // Check other content changes
  if (before.selection !== after.selection) {
    // Selection changes don't need to be in deltas for now
    // They're stored in the snapshot
  }

  return deltas
}

// ============================================
// History Entry Creation
// ============================================

let historyIdCounter = 0

/**
 * Generate a unique history entry ID
 */
export function generateHistoryId(): string {
  return `hist-${Date.now()}-${++historyIdCounter}`
}

/**
 * Infer the change type from a label
 */
export function inferChangeType(label: string): ChangeType {
  if (label.includes('Paint stroke') || label.includes('stroke')) return 'brush-stroke'
  if (label.includes('Layer added')) return 'layer-add'
  if (label.includes('Layer deleted')) return 'layer-delete'
  if (label.includes('Active layer changed')) return 'layer-move'
  if (label.includes('Layer content updated')) return 'brush-stroke'
  if (label.includes('Crop')) return 'crop'
  if (label.includes('Selection')) return 'selection'
  if (label.includes('Path')) return 'path-edit'
  if (label.includes('Guide')) return 'guide-change'
  if (label.includes('Text')) return 'text-edit'
  if (label.includes('Shape')) return 'shape-edit'
  return 'unknown'
}

/**
 * Estimate memory size of an image diff
 */
export function estimateDiffSize(diff: ImageDiff): number {
  if (!diff.compressedData) return 0
  return diff.compressedData.size
}

/**
 * Estimate memory size of a layer delta
 */
export function estimateDeltaSize(delta: LayerDelta): number {
  if (delta.dataDiff) {
    return estimateDiffSize(delta.dataDiff)
  }
  if (delta.fullLayer?.data) {
    // Estimate based on canvas size (uncompressed, but we'll compress)
    return delta.fullLayer.data.width * delta.fullLayer.data.height * 4 * 0.3 // ~30% for compression
  }
  // Property changes are tiny
  return 1024 // 1KB for metadata
}

/**
 * Create a history snapshot entry
 */
export function createFullSnapshot(
  content: EditorContent,
  label: string
): HistorySnapshot {
  const lightContent = serializeContentLight(content)
  
  // Estimate size (layers with canvas data)
  let estimatedSize = 0
  const countLayerSize = (layers: Layer[]) => {
    for (const layer of layers) {
      if (layer.data) {
        // Compressed size estimate (30% of raw)
        estimatedSize += layer.data.width * layer.data.height * 4 * 0.3
      }
      if (layer.children) {
        countLayerSize(layer.children)
      }
    }
  }
  countLayerSize(content.layers)
  
  // Add metadata size
  estimatedSize += JSON.stringify(lightContent).length

  return {
    id: generateHistoryId(),
    type: 'full',
    timestamp: Date.now(),
    label,
    changeType: inferChangeType(label),
    fullContent: lightContent,
    estimatedSize
  }
}

/**
 * Create a delta history entry
 */
export function createDeltaEntry(
  deltas: LayerDelta[],
  baseSnapshotId: string,
  label: string
): HistorySnapshot {
  let estimatedSize = 0
  for (const delta of deltas) {
    estimatedSize += estimateDeltaSize(delta)
  }
  
  return {
    id: generateHistoryId(),
    type: 'delta',
    timestamp: Date.now(),
    label,
    changeType: inferChangeType(label),
    deltas,
    baseSnapshotId,
    estimatedSize
  }
}

// ============================================
// Memory Management
// ============================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Calculate total memory usage of history entries
 */
export function calculateHistoryMemory(entries: HistorySnapshot[]): number {
  return entries.reduce((total, entry) => total + entry.estimatedSize, 0)
}

/**
 * Prune old history entries to stay under memory limit
 * Returns the pruned entries array
 */
export function pruneHistoryEntries(
  entries: HistorySnapshot[],
  currentIndex: number,
  maxMemoryMB: number
): { entries: HistorySnapshot[]; newIndex: number; freedMemory: number } {
  const maxBytes = maxMemoryMB * 1024 * 1024
  let currentMemory = calculateHistoryMemory(entries)
  
  if (currentMemory <= maxBytes) {
    return { entries, newIndex: currentIndex, freedMemory: 0 }
  }

  const newEntries = [...entries]
  let freedMemory = 0

  // Remove entries from the beginning (oldest) until under limit
  // But never remove the current position or newer
  while (currentMemory > maxBytes && newEntries.length > 1 && currentIndex > 0) {
    const removed = newEntries.shift()
    if (removed) {
      freedMemory += removed.estimatedSize
      currentMemory -= removed.estimatedSize
    }
  }

  return {
    entries: newEntries,
    newIndex: Math.max(0, currentIndex - (entries.length - newEntries.length)),
    freedMemory
  }
}

// ============================================
// Canvas Storage Cache
// ============================================

/**
 * A simple LRU cache for storing canvas blobs
 * This keeps canvas data separate from the main history structure
 */
export class CanvasStorageCache {
  private cache: Map<string, { blob: Blob; lastAccess: number }> = new Map()
  private maxSize: number
  private currentSize: number = 0

  constructor(maxSizeMB: number = 200) {
    this.maxSize = maxSizeMB * 1024 * 1024
  }

  async set(id: string, canvas: HTMLCanvasElement): Promise<void> {
    const blob = await compressCanvas(canvas)
    
    // Evict old entries if needed
    while (this.currentSize + blob.size > this.maxSize && this.cache.size > 0) {
      this.evictOldest()
    }

    this.cache.set(id, { blob, lastAccess: Date.now() })
    this.currentSize += blob.size
  }

  async get(id: string): Promise<HTMLCanvasElement | null> {
    const entry = this.cache.get(id)
    if (!entry) return null
    
    entry.lastAccess = Date.now()
    return decompressCanvas(entry.blob)
  }

  has(id: string): boolean {
    return this.cache.has(id)
  }

  delete(id: string): void {
    const entry = this.cache.get(id)
    if (entry) {
      this.currentSize -= entry.blob.size
      this.cache.delete(id)
    }
  }

  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  getStats(): { entries: number; sizeMB: number; maxSizeMB: number } {
    return {
      entries: this.cache.size,
      sizeMB: this.currentSize / (1024 * 1024),
      maxSizeMB: this.maxSize / (1024 * 1024)
    }
  }
}

// Singleton instance
export const canvasCache = new CanvasStorageCache()