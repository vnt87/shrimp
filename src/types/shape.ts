/**
 * Vector Shape Type Definitions
 * 
 * This module defines the core types for vector-based shape layers in SHRIMP.
 * Shapes are stored as vector data (paths) and rendered on-demand, allowing
 * for non-destructive editing similar to Photoshop's shape layers.
 */

import type { VectorPath } from '../path/types'

/**
 * Unique identifier for shape primitives
 */
export type ShapePrimitiveType = 'rect' | 'ellipse' | 'polygon' | 'line' | 'path' | 'custom'

/**
 * Fill type for shapes
 */
export type ShapeFillType = 'none' | 'solid' | 'gradient'

/**
 * Stroke style for shape outlines
 */
export type ShapeStrokeStyle = 'solid' | 'dashed' | 'dotted'

/**
 * Gradient direction for gradient fills
 */
export type GradientDirection = 'linear' | 'radial'

/**
 * 2D transform for individual shapes within a layer
 */
export interface ShapeTransform {
  /** X translation in canvas coordinates */
  x: number
  /** Y translation in canvas coordinates */
  y: number
  /** Horizontal scale factor (1.0 = 100%) */
  scaleX: number
  /** Vertical scale factor (1.0 = 100%) */
  scaleY: number
  /** Rotation in radians */
  rotation: number
  /** Skew X in radians */
  skewX: number
  /** Skew Y in radians */
  skewY: number
}

/**
 * Gradient stop definition
 */
export interface ShapeGradientStop {
  /** Position along gradient (0-1) */
  offset: number
  /** Color at this stop */
  color: string
  /** Opacity at this stop (0-1) */
  opacity: number
}

/**
 * Gradient configuration for shape fills
 */
export interface ShapeGradient {
  /** Gradient type */
  type: GradientDirection
  /** Start point X (normalized 0-1 or absolute) */
  startX: number
  /** Start point Y */
  startY: number
  /** End point X */
  endX: number
  /** End point Y */
  endY: number
  /** Gradient color stops */
  stops: ShapeGradientStop[]
}

/**
 * Shape fill configuration
 */
export interface ShapeFill {
  /** Fill type */
  type: ShapeFillType
  /** Solid fill color (CSS color string) */
  color: string
  /** Fill opacity (0-1) */
  opacity: number
  /** Gradient configuration (when type is 'gradient') */
  gradient: ShapeGradient | null
}

/**
 * Shape stroke configuration
 */
export interface ShapeStroke {
  /** Stroke color (CSS color string) */
  color: string
  /** Stroke width in pixels */
  width: number
  /** Stroke opacity (0-1) */
  opacity: number
  /** Stroke style */
  style: ShapeStrokeStyle
  /** Dash pattern for dashed strokes (array of on/off lengths) */
  dashPattern: number[]
  /** Dash offset for animated dashes */
  dashOffset: number
  /** Line cap style */
  lineCap: CanvasLineCap
  /** Line join style */
  lineJoin: CanvasLineJoin
  /** Miter limit for sharp corners */
  miterLimit: number
}

/**
 * Default transform (identity)
 */
export const DEFAULT_SHAPE_TRANSFORM: ShapeTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
}

/**
 * Default fill configuration
 */
export const DEFAULT_SHAPE_FILL: ShapeFill = {
  type: 'solid',
  color: '#000000',
  opacity: 1,
  gradient: null,
}

/**
 * Default stroke configuration
 */
export const DEFAULT_SHAPE_STROKE: ShapeStroke = {
  color: '#000000',
  width: 2,
  opacity: 1,
  style: 'solid',
  dashPattern: [10, 5],
  dashOffset: 0,
  lineCap: 'round',
  lineJoin: 'round',
  miterLimit: 10,
}

/**
 * A single vector shape within a shape layer
 */
export interface VectorShape {
  /** Unique identifier */
  id: string
  /** Primitive type */
  type: ShapePrimitiveType
  /** Shape name (for UI display) */
  name: string
  /** Whether shape is visible */
  visible: boolean
  /** Whether shape is locked (non-editable) */
  locked: boolean
  /** Vector path data (Bézier curves) */
  path: VectorPath
  /** Shape-specific transform (relative to layer) */
  transform: ShapeTransform
  /** Fill configuration */
  fill: ShapeFill
  /** Stroke configuration */
  stroke: ShapeStroke
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
}

/**
 * Shape layer data stored in Layer.shapeData
 */
export interface ShapeLayerData {
  /** Array of shapes in this layer */
  shapes: VectorShape[]
  /** ID of currently selected shape (for editing) */
  activeShapeId: string | null
  /** IDs of multiply-selected shapes (for group operations) */
  selectedShapeIds: string[]
  /** Global fill override (applies to all shapes if set) */
  globalFill: ShapeFill | null
  /** Global stroke override (applies to all shapes if set) */
  globalStroke: ShapeStroke | null
}

/**
 * Parameters for creating a new shape
 */
export interface CreateShapeParams {
  /** Shape type */
  type: ShapePrimitiveType
  /** Initial name */
  name?: string
  /** Initial path data */
  path: VectorPath
  /** Initial fill */
  fill?: Partial<ShapeFill>
  /** Initial stroke */
  stroke?: Partial<ShapeStroke>
  /** Initial transform */
  transform?: Partial<ShapeTransform>
}

/**
 * Shape bounds result
 */
export interface ShapeBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

/**
 * Boolean operation types for shape combination
 */
export type BooleanOperationType = 'union' | 'subtract' | 'intersect' | 'exclude'

/**
 * Shape edit action types for history
 */
export type ShapeEditActionType = 
  | 'create'
  | 'delete'
  | 'modify-path'
  | 'modify-transform'
  | 'modify-fill'
  | 'modify-stroke'
  | 'boolean-operation'
  | 'duplicate'
  | 'reorder'

/**
 * History entry for shape edits
 */
export interface ShapeEditHistoryEntry {
  /** Action type */
  action: ShapeEditActionType
  /** Affected shape IDs */
  shapeIds: string[]
  /** Timestamp */
  timestamp: number
  /** Optional description */
  description?: string
}