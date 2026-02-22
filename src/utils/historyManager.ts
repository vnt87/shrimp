/**
 * History Manager
 * 
 * A memory-efficient history manager that uses delta compression
 * to reduce memory usage while maintaining full undo/redo capability.
 */

import type { 
  HistorySnapshot, 
  HistoryStore, 
  HistoryConfig, 
  HistoryStats,
  HistoryEvent,
  LayerDelta
} from '../types/history'
import type { EditorContent, Layer } from '../components/EditorContext'
import {
  createFullSnapshot,
  createDeltaEntry,
  computeContentDeltas,
  calculateHistoryMemory,
  pruneHistoryEntries,
  applyImageDiff,
  formatBytes
} from './historyCompression'

type HistoryEventListener = (event: HistoryEvent) => void

/**
 * Get configuration from localStorage preferences
 */
function getHistoryConfig(): HistoryConfig {
  try {
    const stored = localStorage.getItem('shrimp_preferences')
    if (stored) {
      const prefs = JSON.parse(stored)
      return {
        maxEntries: prefs.undoLevels ?? 50,
        snapshotInterval: 10, // Create full snapshot every 10 operations
        maxMemoryMB: prefs.historyMemoryMB ?? 500
      }
    }
  } catch {
    // Ignore errors
  }
  return {
    maxEntries: 50,
    snapshotInterval: 10,
    maxMemoryMB: 500
  }
}

/**
 * History Manager class
 * 
 * Manages history with delta compression for memory efficiency.
 */
export class HistoryManager {
  private store: HistoryStore
  private listeners: Set<HistoryEventListener> = new Set()
  private operationCount: number = 0
  private pendingCanvasData: Map<string, HTMLCanvasElement> = new Map()
  
  /**
   * Reference to current content for delta computation
   */
  private currentContent: EditorContent | null = null

  constructor(config?: HistoryConfig) {
    const finalConfig = { ...getHistoryConfig(), ...config }
    this.store = {
      entries: [],
      currentIndex: -1,
      maxEntries: finalConfig.maxEntries ?? 50,
      snapshotInterval: finalConfig.snapshotInterval ?? 10,
      maxMemoryMB: finalConfig.maxMemoryMB ?? 500,
      currentMemoryUsage: 0,
      lastSnapshotId: null
    }
  }

  /**
   * Set the current content reference for delta computation
   */
  setCurrentContent(content: EditorContent): void {
    this.currentContent = content
  }

  /**
   * Get current history stats
   */
  getStats(): HistoryStats {
    const now = Date.now()
    const oldestEntry = this.store.entries[0]
    
    return {
      totalEntries: this.store.entries.length,
      snapshotCount: this.store.entries.filter(e => e.type === 'full').length,
      deltaCount: this.store.entries.filter(e => e.type === 'delta').length,
      memoryUsageMB: this.store.currentMemoryUsage / (1024 * 1024),
      memoryLimitMB: this.store.maxMemoryMB,
      oldestEntryAge: oldestEntry ? (now - oldestEntry.timestamp) / 1000 : 0,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.store.currentIndex > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.store.currentIndex < this.store.entries.length - 1
  }

  /**
   * Get the current entry
   */
  getCurrentEntry(): HistorySnapshot | null {
    if (this.store.currentIndex < 0 || this.store.currentIndex >= this.store.entries.length) {
      return null
    }
    return this.store.entries[this.store.currentIndex]
  }

  /**
   * Get all history entries for display
   */
  getEntries(): HistorySnapshot[] {
    return [...this.store.entries]
  }

  /**
   * Get current index
   */
  getCurrentIndex(): number {
    return this.store.currentIndex
  }

  /**
   * Add a history entry
   * This should be called AFTER the content has been modified
   */
  async addEntry(
    newContent: EditorContent,
    label: string,
    forceSnapshot: boolean = false
  ): Promise<HistorySnapshot> {
    // Clear any redo entries (we're branching from current state)
    if (this.store.currentIndex < this.store.entries.length - 1) {
      const removedEntries = this.store.entries.splice(this.store.currentIndex + 1)
      for (const removed of removedEntries) {
        this.store.currentMemoryUsage -= removed.estimatedSize
      }
    }

    // Determine if we should create a snapshot or delta
    const shouldCreateSnapshot = 
      forceSnapshot ||
      this.store.entries.length === 0 ||
      this.operationCount >= this.store.snapshotInterval ||
      !this.store.lastSnapshotId

    let entry: HistorySnapshot

    if (shouldCreateSnapshot || !this.currentContent) {
      // Create full snapshot
      entry = createFullSnapshot(newContent, label)
      this.operationCount = 0
      this.store.lastSnapshotId = entry.id
    } else {
      // Create delta entry
      try {
        const deltas = await computeContentDeltas(this.currentContent, newContent)
        
        if (deltas.length === 0) {
          // No actual changes, create minimal entry
          entry = createFullSnapshot(newContent, label)
          this.store.lastSnapshotId = entry.id
        } else {
          // Find the last snapshot to base our delta on
          const baseSnapshotId = this.store.lastSnapshotId || this.store.entries[0]?.id || ''
          entry = createDeltaEntry(deltas, baseSnapshotId, label)
        }
      } catch (error) {
        console.warn('Failed to compute deltas, falling back to snapshot:', error)
        entry = createFullSnapshot(newContent, label)
        this.operationCount = 0
        this.store.lastSnapshotId = entry.id
      }
    }

    // Add entry
    this.store.entries.push(entry)
    this.store.currentIndex = this.store.entries.length - 1
    this.store.currentMemoryUsage += entry.estimatedSize
    this.operationCount++

    // Update current content reference
    this.currentContent = this.cloneContent(newContent)

    // Check memory limits
    this.checkMemoryLimit()

    // Enforce max entries
    while (this.store.entries.length > this.store.maxEntries && this.store.entries.length > 1) {
      const removed = this.store.entries.shift()!
      this.store.currentMemoryUsage -= removed.estimatedSize
      this.store.currentIndex--
      
      // Update lastSnapshotId if we removed the last snapshot
      if (removed.id === this.store.lastSnapshotId) {
        const lastSnapshot = [...this.store.entries].reverse().find(e => e.type === 'full')
        this.store.lastSnapshotId = lastSnapshot?.id ?? null
      }
    }

    // Ensure currentIndex is valid
    this.store.currentIndex = Math.max(0, Math.min(this.store.currentIndex, this.store.entries.length - 1))

    // Emit event
    this.emit({ type: 'entry-added', stats: this.getStats(), entry })

    return entry
  }

  /**
   * Undo - get the previous state
   * Returns the content to restore, or null if cannot undo
   */
  async undo(): Promise<EditorContent | null> {
    if (!this.canUndo()) {
      return null
    }

    const targetIndex = this.store.currentIndex - 1
    const content = await this.restoreToIndex(targetIndex)
    
    if (content) {
      this.store.currentIndex = targetIndex
      this.emit({ type: 'undo', stats: this.getStats() })
    }
    
    return content
  }

  /**
   * Redo - get the next state
   * Returns the content to restore, or null if cannot redo
   */
  async redo(): Promise<EditorContent | null> {
    if (!this.canRedo()) {
      return null
    }

    const targetIndex = this.store.currentIndex + 1
    const content = await this.restoreToIndex(targetIndex)
    
    if (content) {
      this.store.currentIndex = targetIndex
      this.emit({ type: 'redo', stats: this.getStats() })
    }
    
    return content
  }

  /**
   * Restore to a specific history index
   */
  async restoreToIndex(targetIndex: number): Promise<EditorContent | null> {
    if (targetIndex < 0 || targetIndex >= this.store.entries.length) {
      return null
    }

    // Find the nearest full snapshot at or before targetIndex
    let snapshotIndex = targetIndex
    let snapshot: HistorySnapshot | null = null
    
    while (snapshotIndex >= 0) {
      const entry = this.store.entries[snapshotIndex]
      if (entry.type === 'full' && entry.fullContent) {
        snapshot = entry
        break
      }
      snapshotIndex--
    }

    if (!snapshot || !snapshot.fullContent) {
      // No snapshot found, cannot restore
      console.error('No snapshot found for restoration')
      return null
    }

    // Start from the snapshot and apply deltas forward
    let content = await this.reconstructContent(snapshot)

    // Apply deltas from snapshotIndex+1 to targetIndex
    for (let i = snapshotIndex + 1; i <= targetIndex; i++) {
      const entry = this.store.entries[i]
      if (entry.type === 'delta' && entry.deltas) {
        content = await this.applyDeltas(content, entry.deltas)
      }
    }

    this.store.currentIndex = targetIndex
    this.currentContent = this.cloneContent(content)
    
    return content
  }

  /**
   * Reconstruct full EditorContent from a snapshot
   */
  private async reconstructContent(snapshot: HistorySnapshot): Promise<EditorContent> {
    if (!snapshot.fullContent) {
      throw new Error('Snapshot has no content')
    }

    const light = snapshot.fullContent
    
    // Reconstruct layers with canvas data
    const layers = await this.reconstructLayers(light.layers)

    return {
      layers,
      activeLayerId: light.activeLayerId,
      canvasSize: light.canvasSize,
      selection: light.selection,
      guides: light.guides,
      paths: light.paths,
      activePathId: light.activePathId
    }
  }

  /**
   * Reconstruct layers from lightweight serialization
   */
  private async reconstructLayers(lightLayers: any[]): Promise<Layer[]> {
    const layers: Layer[] = []

    for (const light of lightLayers) {
      const layer: Layer = {
        id: light.id,
        name: light.name,
        visible: light.visible,
        locked: light.locked,
        opacity: light.opacity,
        blendMode: light.blendMode,
        data: null,
        filters: light.filters || [],
        x: light.x,
        y: light.y,
        type: light.type,
        children: light.children ? await this.reconstructLayers(light.children) : undefined,
        text: light.text,
        textStyle: light.textStyle,
        shapeData: light.shapeData
      }

      // Canvas data will be restored when deltas are applied
      // For now, create empty canvas for 'layer' type
      if (layer.type === 'layer') {
        layer.data = document.createElement('canvas')
        layer.data.width = 1
        layer.data.height = 1
      }

      layers.push(layer)
    }

    return layers
  }

  /**
   * Apply deltas to content
   */
  private async applyDeltas(content: EditorContent, deltas: LayerDelta[]): Promise<EditorContent> {
    const result = this.cloneContent(content)
    
    // Create layer map for quick access
    const layerMap = new Map<string, Layer>()
    const flattenToMap = (layers: Layer[]) => {
      for (const layer of layers) {
        layerMap.set(layer.id, layer)
        if (layer.children) flattenToMap(layer.children)
      }
    }
    flattenToMap(result.layers)

    for (const delta of deltas) {
      const layer = layerMap.get(delta.layerId)
      
      if (delta.changeType === 'deleted') {
        // Layer was deleted - we need to remove it
        // For undo, this means the layer should be added back
        // This is complex, for now skip
        continue
      }

      if (delta.changeType === 'created') {
        // Layer was created - for undo, skip (it shouldn't exist yet)
        continue
      }

      if (!layer) continue

      if (delta.changeType === 'properties' && delta.propertyChanges) {
        // Apply property changes
        Object.assign(layer, delta.propertyChanges)
      }

      if (delta.changeType === 'data' && delta.dataDiff) {
        // Apply image diff
        if (layer.data && delta.dataDiff.compressedData) {
          layer.data = await applyImageDiff(layer.data, delta.dataDiff)
        } else if (delta.dataDiff.compressedData) {
          layer.data = await applyImageDiff(null, delta.dataDiff)
        }
      }
    }

    return result
  }

  /**
   * Clone content (shallow clone of structure, but canvas refs are shared)
   */
  private cloneContent(content: EditorContent): EditorContent {
    return {
      layers: content.layers.map(l => this.cloneLayer(l)),
      activeLayerId: content.activeLayerId,
      canvasSize: { ...content.canvasSize },
      selection: content.selection ? { ...content.selection } : null,
      guides: [...content.guides],
      paths: [...content.paths],
      activePathId: content.activePathId
    }
  }

  /**
   * Clone a layer (shallow, shares canvas reference)
   */
  private cloneLayer(layer: Layer): Layer {
    return {
      ...layer,
      children: layer.children ? layer.children.map(l => this.cloneLayer(l)) : undefined,
      filters: layer.filters ? [...layer.filters] : []
    }
  }

  /**
   * Check memory limit and emit warning if needed
   */
  private checkMemoryLimit(): void {
    const usageMB = this.store.currentMemoryUsage / (1024 * 1024)
    const limitMB = this.store.maxMemoryMB

    if (usageMB > limitMB * 0.9) {
      // Approaching limit, prune old entries
      const result = pruneHistoryEntries(
        this.store.entries,
        this.store.currentIndex,
        this.store.maxMemoryMB
      )
      
      if (result.freedMemory > 0) {
        this.store.entries = result.entries
        this.store.currentIndex = result.newIndex
        this.store.currentMemoryUsage -= result.freedMemory
        
        console.log(`History pruned: freed ${formatBytes(result.freedMemory)}`)
      }

      this.emit({ 
        type: 'memory-warning', 
        stats: this.getStats() 
      })
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.store.entries = []
    this.store.currentIndex = -1
    this.store.currentMemoryUsage = 0
    this.store.lastSnapshotId = null
    this.operationCount = 0
    this.currentContent = null
    this.pendingCanvasData.clear()
    
    this.emit({ type: 'clear', stats: this.getStats() })
  }

  /**
   * Subscribe to history events
   */
  subscribe(listener: HistoryEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: HistoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('History event listener error:', error)
      }
    }
  }

  /**
   * Store canvas data for a layer (used before modification)
   */
  storeCanvasData(layerId: string, canvas: HTMLCanvasElement): void {
    this.pendingCanvasData.set(layerId, canvas)
  }

  /**
   * Get stored canvas data
   */
  getStoredCanvasData(layerId: string): HTMLCanvasElement | undefined {
    return this.pendingCanvasData.get(layerId)
  }

  /**
   * Export history for persistence
   */
  async exportForStorage(): Promise<{
    entries: HistorySnapshot[];
    currentIndex: number;
  }> {
    // Note: Blob data in deltas needs special handling for IndexedDB
    // For now, we export as-is and handle serialization separately
    return {
      entries: this.store.entries,
      currentIndex: this.store.currentIndex
    }
  }

  /**
   * Import history from persistence
   */
  async importFromStorage(data: {
    entries: HistorySnapshot[];
    currentIndex: number;
  }): Promise<void> {
    this.store.entries = data.entries
    this.store.currentIndex = data.currentIndex
    this.store.currentMemoryUsage = calculateHistoryMemory(data.entries)
    
    // Find last snapshot
    for (let i = data.entries.length - 1; i >= 0; i--) {
      if (data.entries[i].type === 'full') {
        this.store.lastSnapshotId = data.entries[i].id
        break
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): { maxEntries: number; maxMemoryMB: number; snapshotInterval: number } {
    return {
      maxEntries: this.store.maxEntries,
      maxMemoryMB: this.store.maxMemoryMB,
      snapshotInterval: this.store.snapshotInterval
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HistoryConfig>): void {
    if (config.maxEntries !== undefined) {
      this.store.maxEntries = config.maxEntries
    }
    if (config.maxMemoryMB !== undefined) {
      this.store.maxMemoryMB = config.maxMemoryMB
    }
    if (config.snapshotInterval !== undefined) {
      this.store.snapshotInterval = config.snapshotInterval
    }
  }
}

// Singleton instance
let historyManagerInstance: HistoryManager | null = null

/**
 * Get the global history manager instance
 */
export function getHistoryManager(): HistoryManager {
  if (!historyManagerInstance) {
    historyManagerInstance = new HistoryManager()
  }
  return historyManagerInstance
}

/**
 * Reset the global history manager (useful for testing)
 */
export function resetHistoryManager(): void {
  if (historyManagerInstance) {
    historyManagerInstance.clear()
  }
  historyManagerInstance = null
}