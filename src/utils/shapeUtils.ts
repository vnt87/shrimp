/**
 * Shape Utility Functions
 * 
 * This module provides utilities for creating, manipulating, and rendering
 * vector shapes. It builds on the existing path system and provides the
 * core functionality for the shape layer system.
 */

import type { Vec2, VectorPath, PathNode } from '../path/types'
import { createPathNode, createVectorPath } from '../path/commands'
import type {
  VectorShape,
  ShapeLayerData,
  ShapeTransform,
  ShapePrimitiveType,
  CreateShapeParams,
  ShapeBounds,
  ShapeGradient,
} from '../types/shape'
import {
  DEFAULT_SHAPE_TRANSFORM,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
} from '../types/shape'

/**
 * Generate a unique ID
 */
export function makeShapeId(prefix: string = 'shape_'): string {
  return `${prefix}${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Create a new vector shape with default settings
 */
export function createVectorShape(params: CreateShapeParams): VectorShape {
  const now = Date.now()
  return {
    id: makeShapeId(),
    type: params.type,
    name: params.name || getDefaultShapeName(params.type),
    visible: true,
    locked: false,
    path: params.path,
    transform: { ...DEFAULT_SHAPE_TRANSFORM, ...params.transform },
    fill: { ...DEFAULT_SHAPE_FILL, ...params.fill },
    stroke: { ...DEFAULT_SHAPE_STROKE, ...params.stroke },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Get default name for a shape type
 */
export function getDefaultShapeName(type: ShapePrimitiveType): string {
  const names: Record<ShapePrimitiveType, string> = {
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    polygon: 'Polygon',
    line: 'Line',
    path: 'Path',
    custom: 'Custom Shape',
  }
  return names[type] || 'Shape'
}

/**
 * Create a rectangle path
 */
export function createRectPath(x: number, y: number, width: number, height: number, cornerRadius: number = 0): VectorPath {
  const path = createVectorPath('Rectangle')
  
  if (cornerRadius <= 0) {
    // Simple rectangle with sharp corners
    const nodes: PathNode[] = [
      createPathNode(x, y, 'corner'),
      createPathNode(x + width, y, 'corner'),
      createPathNode(x + width, y + height, 'corner'),
      createPathNode(x, y + height, 'corner'),
    ]
    path.nodes = nodes
    path.closed = true
  } else {
    // Rounded rectangle
    const r = Math.min(cornerRadius, width / 2, height / 2)
    const nodes: PathNode[] = [
      // Top-left corner
      { ...createPathNode(x + r, y, 'smooth'), handleOut: { x: x + r, y: y } },
      // Top edge
      { ...createPathNode(x + width - r, y, 'smooth'), handleIn: { x: x + width - r, y: y }, handleOut: { x: x + width - r, y: y } },
      // Top-right corner
      { ...createPathNode(x + width, y + r, 'smooth'), handleIn: { x: x + width, y: y + r } },
      // Right edge
      { ...createPathNode(x + width, y + height - r, 'smooth'), handleIn: { x: x + width, y: y + height - r }, handleOut: { x: x + width, y: y + height - r } },
      // Bottom-right corner
      { ...createPathNode(x + width - r, y + height, 'smooth'), handleIn: { x: x + width, y: y + height } },
      // Bottom edge
      { ...createPathNode(x + r, y + height, 'smooth'), handleIn: { x: x + r, y: y + height }, handleOut: { x: x + r, y: y + height } },
      // Bottom-left corner
      { ...createPathNode(x, y + height - r, 'smooth'), handleIn: { x: x, y: y + height } },
      // Left edge
      { ...createPathNode(x, y + r, 'smooth'), handleIn: { x: x, y: y + r }, handleOut: { x: x, y: y + r } },
    ]
    path.nodes = nodes
    path.closed = true
  }
  
  return path
}

/**
 * Create an ellipse path
 */
export function createEllipsePath(cx: number, cy: number, rx: number, ry: number): VectorPath {
  const path = createVectorPath('Ellipse')
  
  // Approximate ellipse with 4 cubic Bézier curves
  // Using the standard approximation: control points at distance = (4/3)*tan(pi/8) * radius
  const k = 0.5522847498 // (4/3) * (sqrt(2) - 1)
  const kx = k * rx
  const ky = k * ry
  
  const nodes: PathNode[] = [
    // Right point (0°)
    {
      id: makeShapeId('node_'),
      x: cx + rx,
      y: cy,
      handleIn: { x: cx + rx, y: cy + ky },
      handleOut: { x: cx + rx, y: cy - ky },
      type: 'smooth',
    },
    // Top point (90°)
    {
      id: makeShapeId('node_'),
      x: cx,
      y: cy - ry,
      handleIn: { x: cx + kx, y: cy - ry },
      handleOut: { x: cx - kx, y: cy - ry },
      type: 'smooth',
    },
    // Left point (180°)
    {
      id: makeShapeId('node_'),
      x: cx - rx,
      y: cy,
      handleIn: { x: cx - rx, y: cy - ky },
      handleOut: { x: cx - rx, y: cy + ky },
      type: 'smooth',
    },
    // Bottom point (270°)
    {
      id: makeShapeId('node_'),
      x: cx,
      y: cy + ry,
      handleIn: { x: cx - kx, y: cy + ry },
      handleOut: { x: cx + kx, y: cy + ry },
      type: 'smooth',
    },
  ]
  
  path.nodes = nodes
  path.closed = true
  return path
}

/**
 * Create a regular polygon path
 */
export function createPolygonPath(cx: number, cy: number, radius: number, sides: number): VectorPath {
  const path = createVectorPath('Polygon')
  
  if (sides < 3) sides = 3
  if (sides > 100) sides = 100
  
  const angleStep = (2 * Math.PI) / sides
  const startAngle = -Math.PI / 2 // Start at top
  
  const nodes: PathNode[] = []
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    nodes.push(createPathNode(x, y, 'corner'))
  }
  
  path.nodes = nodes
  path.closed = true
  return path
}

/**
 * Create a line path
 */
export function createLinePath(x1: number, y1: number, x2: number, y2: number): VectorPath {
  const path = createVectorPath('Line')
  
  path.nodes = [
    createPathNode(x1, y1, 'corner'),
    createPathNode(x2, y2, 'corner'),
  ]
  path.closed = false
  
  return path
}

/**
 * Create shape layer data with default settings
 */
export function createShapeLayerData(): ShapeLayerData {
  return {
    shapes: [],
    activeShapeId: null,
    selectedShapeIds: [],
    globalFill: null,
    globalStroke: null,
  }
}

/**
 * Calculate the bounding box of a shape
 */
export function getShapeBounds(shape: VectorShape): ShapeBounds {
  const { path, transform } = shape
  
  if (path.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  // Collect all points including control handles for bounding box
  for (const node of path.nodes) {
    const points = [
      { x: node.x, y: node.y },
      node.handleIn,
      node.handleOut,
    ].filter(Boolean) as Vec2[]
    
    for (const pt of points) {
      // Apply transform
      const transformed = transformPoint(pt, transform)
      minX = Math.min(minX, transformed.x)
      minY = Math.min(minY, transformed.y)
      maxX = Math.max(maxX, transformed.x)
      maxY = Math.max(maxY, transformed.y)
    }
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

/**
 * Transform a point by a shape transform
 */
export function transformPoint(point: Vec2, transform: ShapeTransform): Vec2 {
  let x = point.x
  let y = point.y
  
  // Apply scale
  x *= transform.scaleX
  y *= transform.scaleY
  
  // Apply skew
  if (transform.skewX !== 0) {
    x += y * Math.tan(transform.skewX)
  }
  if (transform.skewY !== 0) {
    y += x * Math.tan(transform.skewY)
  }
  
  // Apply rotation
  if (transform.rotation !== 0) {
    const cos = Math.cos(transform.rotation)
    const sin = Math.sin(transform.rotation)
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos
    x = rx
    y = ry
  }
  
  // Apply translation
  x += transform.x
  y += transform.y
  
  return { x, y }
}

/**
 * Clone a shape with a new ID
 */
export function cloneShape(shape: VectorShape, newName?: string): VectorShape {
  const now = Date.now()
  return {
    ...shape,
    id: makeShapeId(),
    name: newName || `${shape.name} Copy`,
    path: {
      ...shape.path,
      id: makeShapeId('path_'),
      nodes: shape.path.nodes.map(node => ({
        ...node,
        id: makeShapeId('node_'),
        handleIn: node.handleIn ? { ...node.handleIn } : null,
        handleOut: node.handleOut ? { ...node.handleOut } : null,
      })),
    },
    transform: { ...shape.transform },
    fill: {
      ...shape.fill,
      gradient: shape.fill.gradient ? { ...shape.fill.gradient } : null,
    },
    stroke: { ...shape.stroke },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Apply transform to shape path (bake transform into path)
 */
export function bakeShapeTransform(shape: VectorShape): VectorShape {
  const transformedNodes = shape.path.nodes.map(node => {
    const transformedPt = transformPoint({ x: node.x, y: node.y }, shape.transform)
    const transformedHandleIn = node.handleIn ? transformPoint(node.handleIn, shape.transform) : null
    const transformedHandleOut = node.handleOut ? transformPoint(node.handleOut, shape.transform) : null
    
    return {
      ...node,
      id: makeShapeId('node_'),
      x: transformedPt.x,
      y: transformedPt.y,
      handleIn: transformedHandleIn,
      handleOut: transformedHandleOut,
    }
  })
  
  return {
    ...shape,
    path: {
      ...shape.path,
      nodes: transformedNodes,
    },
    transform: { ...DEFAULT_SHAPE_TRANSFORM },
    updatedAt: Date.now(),
  }
}

/**
 * Draw a shape to a canvas 2D context
 */
export function drawShapeToContext(
  ctx: CanvasRenderingContext2D,
  shape: VectorShape,
  applyTransform: boolean = true
): void {
  const { path, fill, stroke, transform } = shape
  
  if (path.nodes.length === 0) return
  
  ctx.save()
  
  // Apply transform if requested
  if (applyTransform) {
    ctx.translate(transform.x, transform.y)
    ctx.rotate(transform.rotation)
    ctx.scale(transform.scaleX, transform.scaleY)
    if (transform.skewX !== 0 || transform.skewY !== 0) {
      ctx.transform(1, Math.tan(transform.skewY), Math.tan(transform.skewX), 1, 0, 0)
    }
  }
  
  // Build path
  ctx.beginPath()
  
  const first = path.nodes[0]
  ctx.moveTo(first.x, first.y)
  
  for (let i = 1; i < path.nodes.length; i++) {
    const prev = path.nodes[i - 1]
    const curr = path.nodes[i]
    
    const cp1 = prev.handleOut ?? { x: prev.x, y: prev.y }
    const cp2 = curr.handleIn ?? { x: curr.x, y: curr.y }
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, curr.x, curr.y)
  }
  
  if (path.closed && path.nodes.length > 2) {
    const end = path.nodes[path.nodes.length - 1]
    const start = path.nodes[0]
    const cp1 = end.handleOut ?? { x: end.x, y: end.y }
    const cp2 = start.handleIn ?? { x: start.x, y: start.y }
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, start.x, start.y)
    ctx.closePath()
  }
  
  // Apply fill
  if (fill.type !== 'none' && (path.closed || shape.type === 'line')) {
    ctx.globalAlpha = fill.opacity
    
    if (fill.type === 'solid') {
      ctx.fillStyle = fill.color
      ctx.fill()
    } else if (fill.type === 'gradient' && fill.gradient) {
      const grad = createCanvasGradient(ctx, fill.gradient)
      if (grad) {
        ctx.fillStyle = grad
        ctx.fill()
      }
    }
  }
  
  // Apply stroke
  if (stroke.width > 0 && stroke.opacity > 0) {
    ctx.globalAlpha = stroke.opacity
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = stroke.lineCap
    ctx.lineJoin = stroke.lineJoin
    ctx.miterLimit = stroke.miterLimit
    
    if (stroke.style === 'dashed') {
      ctx.setLineDash(stroke.dashPattern)
      ctx.lineDashOffset = stroke.dashOffset
    } else if (stroke.style === 'dotted') {
      ctx.setLineDash([stroke.width, stroke.width * 2])
      ctx.lineDashOffset = stroke.dashOffset
    } else {
      ctx.setLineDash([])
    }
    
    ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * Create a CanvasGradient from ShapeGradient config
 */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: ShapeGradient
): CanvasGradient | null {
  if (gradient.stops.length === 0) return null
  
  let grad: CanvasGradient
  
  if (gradient.type === 'linear') {
    grad = ctx.createLinearGradient(
      gradient.startX,
      gradient.startY,
      gradient.endX,
      gradient.endY
    )
  } else {
    const dx = gradient.endX - gradient.startX
    const dy = gradient.endY - gradient.startY
    const radius = Math.sqrt(dx * dx + dy * dy)
    grad = ctx.createRadialGradient(
      gradient.startX,
      gradient.startY,
      0,
      gradient.startX,
      gradient.startY,
      radius
    )
  }
  
  for (const stop of gradient.stops) {
    const alpha = Math.round(stop.opacity * 255).toString(16).padStart(2, '0')
    grad.addColorStop(stop.offset, stop.color + alpha)
  }
  
  return grad
}

/**
 * Render a shape layer to a canvas
 */
export function renderShapeLayer(
  shapes: VectorShape[],
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  
  for (const shape of shapes) {
    if (!shape.visible) continue
    drawShapeToContext(ctx, shape, true)
  }
  
  return canvas
}

/**
 * Hit test a point against a shape
 */
export function hitTestShape(
  shape: VectorShape,
  point: Vec2,
  tolerance: number = 5
): boolean {
  const bounds = getShapeBounds(shape)
  
  // Quick bounding box check
  if (
    point.x < bounds.minX - tolerance ||
    point.x > bounds.maxX + tolerance ||
    point.y < bounds.minY - tolerance ||
    point.y > bounds.maxY + tolerance
  ) {
    return false
  }
  
  // For closed shapes, check if point is inside
  if (shape.path.closed) {
    return isPointInPath(shape, point)
  }
  
  // For open paths (lines), check distance to path
  return isPointNearPath(shape, point, tolerance)
}

/**
 * Check if a point is inside a closed path
 */
export function isPointInPath(shape: VectorShape, point: Vec2): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  
  // Translate so the point is at origin
  ctx.translate(-point.x, -point.y)
  
  drawShapeToContext(ctx, shape, true)
  
  return ctx.isPointInPath(0.5, 0.5)
}

/**
 * Check if a point is near an open path
 */
export function isPointNearPath(shape: VectorShape, point: Vec2, tolerance: number): boolean {
  const { path, transform } = shape
  const nodes = path.nodes
  
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = transformPoint(nodes[i], transform)
    const p3 = transformPoint(nodes[i + 1], transform)
    
    // Get control points
    const p1 = nodes[i].handleOut 
      ? transformPoint(nodes[i].handleOut!, transform)
      : p0
    const p2 = nodes[i + 1].handleIn
      ? transformPoint(nodes[i + 1].handleIn!, transform)
      : p3
    
    // Sample the curve and check distance
    for (let t = 0; t <= 1; t += 0.05) {
      const pt = cubicBezier(p0, p1, p2, p3, t)
      const dist = Math.sqrt((point.x - pt.x) ** 2 + (point.y - pt.y) ** 2)
      if (dist <= tolerance) return true
    }
  }
  
  return false
}

/**
 * Evaluate a cubic Bézier curve at parameter t
 */
export function cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  }
}

/**
 * Get shape at point in a shape layer
 */
export function getShapeAtPoint(
  shapes: VectorShape[],
  point: Vec2,
  tolerance: number = 5
): VectorShape | null {
  // Iterate in reverse order (top to bottom in visual stacking)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i]
    if (!shape.visible || shape.locked) continue
    if (hitTestShape(shape, point, tolerance)) {
      return shape
    }
  }
  return null
}