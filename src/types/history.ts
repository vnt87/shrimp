/**
 * History System Types
 * 
 * This module defines types for a memory-efficient history system that uses
 * delta compression instead of full snapshots.
 */

import { Layer } from '../components/EditorContext'

/**
 * A compressed image difference between two canvas states
 */
export interface ImageDiff {
  /** Whether this is a bounding-box diff or full image */
  type: 'bbox' | 'full'
  /** X offset of the changed region */
  x: number
  /** Y offset of the changed region */
  y: number
  /** Width of the changed region */
  width: number
  /** Height of the changed region */
  height: number
  /** Compressed pixel data (PNG or WebP Blob) */
  compressedData: Blob | null
  /** Hash of the original data for validation */
  hash?: string
}

/**
 * Delta describing what changed in a layer
 */
export interface LayerDelta {
  /** ID of the affected layer */
  layerId: string
  /** Type of change */
  changeType: 'data' | 'properties' | 'created' | 'deleted' | 'reordered'
  /** For data changes: the pixel difference */
  dataDiff?: ImageDiff
  /** For property changes: only the changed properties */
  propertyChanges?: Partial<Layer>
  /** For created/deleted: the full layer data */
  fullLayer?: Layer
  /** For reordering: old and new indices */
  reorderInfo?: { oldIndex: number; newIndex: number }
}

/**
 * Types of changes that can occur
 */
export type ChangeType = 
  | 'brush-stroke'
  | 'layer-add'
  | 'layer-delete'
  | 'layer-move'
  | 'layer-rename'
  | 'layer-opacity'
  | 'layer-blend'
  | 'layer-visibility'
  | 'layer-lock'
  | 'filter-add'
  | 'filter-remove'
  | 'filter-update'
  | 'selection'
  | 'crop'
  | 'transform'
  | 'path-edit'
  | 'guide-change'
  | 'canvas-resize'
  | 'text-edit'
  | 'shape-edit'
  | 'unknown'

/**
 * A history entry - either a full snapshot or a delta
 */
export interface HistorySnapshot {
  /** Unique identifier */
  id: string
  /** Type of storage */
  type: 'full' | 'delta'
  /** When this entry was created */
  timestamp: number
  /** Human-readable label */
  label: string
  /** Type of change that created this entry */
  changeType: ChangeType
  /** For full snapshots: the complete serialized content */
  fullContent?: SerializedEditorContentLight
  /** For deltas: the list of changes */
  deltas?: LayerDelta[]
  /** For deltas: index of the base snapshot this applies to */
  baseSnapshotId?: string
  /** Estimated memory size in bytes */
  estimatedSize: number
}

/**
 * Lightweight serialized editor content (without heavy canvas data)
 * Canvas data is stored separately in compressed form
 */
export interface SerializedEditorContentLight {
  /** Layer definitions without canvas data */
  layers: SerializedLayerLight[]
  /** Active layer ID */
  activeLayerId: string | null
  /** Canvas dimensions */
  canvasSize: { width: number; height: number }
  /** Selection state */
  selection: any // Selection type from EditorContext
  /** Guides */
  guides: any[] // Guide[] from EditorContext
  /** Vector paths */
  paths: any[] // VectorPath[] from EditorContext
  /** Active path ID */
  activePathId: string | null
}

/**
 * Lightweight serialized layer (without canvas data)
 */
export interface SerializedLayerLight {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: string
  filters: any[]
  x: number
  y: number
  type: 'layer' | 'group' | 'text' | 'shape'
  children?: SerializedLayerLight[]
  // Text specific
  text?: string
  textStyle?: any
  // Shape specific
  shapeData?: any
  // Canvas data reference (stored separately)
  canvasRef?: string
}

/**
 * The main history store structure
 */
export interface HistoryStore {
  /** All history entries (snapshots and deltas) */
  entries: HistorySnapshot[]
  /** Current position in history */
  currentIndex: number
  /** Maximum number of entries */
  maxEntries: number
  /** Create a full snapshot every N operations */
  snapshotInterval: number
  /** Maximum memory usage in MB */
  maxMemoryMB: number
  /** Current estimated memory usage in bytes */
  currentMemoryUsage: number
  /** ID of the most recent full snapshot */
  lastSnapshotId: string | null
}

/**
 * Options for history configuration
 */
export interface HistoryConfig {
  /** Maximum number of history entries (default: 50) */
  maxEntries?: number
  /** Create full snapshot every N operations (default: 10) */
  snapshotInterval?: number
  /** Maximum memory in MB (default: 500) */
  maxMemoryMB?: number
}

/**
 * Result of applying a delta
 */
export interface ApplyDeltaResult {
  success: boolean
  error?: string
  newContent?: SerializedEditorContentLight
}

/**
 * Statistics about history memory usage
 */
export interface HistoryStats {
  totalEntries: number
  snapshotCount: number
  deltaCount: number
  memoryUsageMB: number
  memoryLimitMB: number
  oldestEntryAge: number // seconds
  canUndo: boolean
  canRedo: boolean
}

/**
 * Event emitted when history changes
 */
export interface HistoryEvent {
  type: 'entry-added' | 'undo' | 'redo' | 'clear' | 'memory-warning'
  stats: HistoryStats
  entry?: HistorySnapshot
}