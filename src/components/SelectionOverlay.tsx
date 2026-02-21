import { useState, useCallback } from 'react'
import { extend, useTick } from '@pixi/react'
import { Graphics } from 'pixi.js'
import type { Selection } from './EditorContext'

extend({ Graphics })

interface SelectionOverlayProps {
    selection: Selection
}

/**
 * GPU-rendered marching ants selection overlay using Pixi.js Graphics.
 * Uses useState for dashOffset so the component re-renders every frame,
 * producing a smooth "marching ants" animation even when the cursor is still.
 */
export default function SelectionOverlay({ selection }: SelectionOverlayProps) {
    const [dashOffset, setDashOffset] = useState(0)

    // Animate the dash offset every render frame
    useTick(() => {
        setDashOffset(prev => (prev + 0.5) % 16)
    })

    const draw = useCallback(
        (g: Graphics) => {
            g.clear()

            const { x, y, width, height, type } = selection
            if (width === 0 && height === 0 && type !== 'path') return

            const offset = dashOffset
            const dashLength = 4
            const gapLength = 4

            // Helper function to draw dashed segments along edges
            const drawDashedEdge = (g: Graphics, x1: number, y1: number, x2: number, y2: number, offset: number, dashLen: number, gapLen: number) => {
                const dx = x2 - x1
                const dy = y2 - y1
                const edgeLen = Math.sqrt(dx * dx + dy * dy)
                if (edgeLen === 0) return

                const ux = dx / edgeLen
                const uy = dy / edgeLen
                let pos = -offset % (dashLen + gapLen)

                while (pos < edgeLen) {
                    const start = Math.max(0, pos)
                    const end = Math.min(edgeLen, pos + dashLen)
                    if (end > start && start < edgeLen) {
                        g.moveTo(x1 + ux * start, y1 + uy * start)
                        g.lineTo(x1 + ux * end, y1 + uy * end)
                    }
                    pos += dashLen + gapLen
                }
            }

            if (type === 'ellipse') {
                // For ellipse, generate points along the path
                const cx = x + width / 2
                const cy = y + height / 2
                const rx = Math.abs(width / 2)
                const ry = Math.abs(height / 2)
                
                // Calculate approximate perimeter for dash positioning
                const h = Math.pow((rx - ry) / (rx + ry), 2)
                const perimeter = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
                
                // Generate points along the ellipse
                const totalSteps = Math.max(64, Math.floor(perimeter * 0.5))
                const points: { x: number, y: number }[] = []
                for (let i = 0; i <= totalSteps; i++) {
                    const angle = (i / totalSteps) * Math.PI * 2
                    points.push({
                        x: cx + rx * Math.cos(angle),
                        y: cy + ry * Math.sin(angle)
                    })
                }

                // Draw black dashed outline (offset by half the pattern for contrast)
                for (let i = 0; i < points.length - 1; i++) {
                    drawDashedEdge(g, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, offset + dashLength + gapLength, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0x000000, alpha: 0.7 })

                // Draw white dashed outline (foreground, animated)
                for (let i = 0; i < points.length - 1; i++) {
                    drawDashedEdge(g, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, offset, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0xffffff, alpha: 1 })
            } else if (type === 'path' && selection.path) {
                // Path selection (Lasso / Magic Wand)
                const points = selection.path
                if (points.length < 2) return

                // Draw black dashed outline (offset by half the pattern for contrast)
                for (let i = 0; i < points.length; i++) {
                    const p1 = points[i]
                    const p2 = points[(i + 1) % points.length]
                    drawDashedEdge(g, p1.x, p1.y, p2.x, p2.y, offset + dashLength + gapLength, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0x000000, alpha: 0.7 })

                // Draw white dashed outline (foreground, animated)
                for (let i = 0; i < points.length; i++) {
                    const p1 = points[i]
                    const p2 = points[(i + 1) % points.length]
                    drawDashedEdge(g, p1.x, p1.y, p2.x, p2.y, offset, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0xffffff, alpha: 1 })

            } else {
                // Rectangle: draw four edges with dashes
                const edges = [
                    [x, y, x + width, y],
                    [x + width, y, x + width, y + height],
                    [x + width, y + height, x, y + height],
                    [x, y + height, x, y],
                ]

                // Draw black dashed outline (offset by half the pattern for contrast)
                for (const [x1, y1, x2, y2] of edges) {
                    drawDashedEdge(g, x1, y1, x2, y2, offset + dashLength + gapLength, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0x000000, alpha: 0.7 })

                // Draw white dashed outline (foreground, animated)
                for (const [x1, y1, x2, y2] of edges) {
                    drawDashedEdge(g, x1, y1, x2, y2, offset, dashLength, gapLength)
                }
                g.stroke({ width: 1, color: 0xffffff, alpha: 1 })
            }
        },
        [selection, dashOffset]
    )

    return <pixiGraphics draw={draw} />
}
