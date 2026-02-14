import { useCallback, useRef } from 'react'
import { extend, useTick } from '@pixi/react'
import { Graphics } from 'pixi.js'
import type { Selection } from './EditorContext'

extend({ Graphics })

interface SelectionOverlayProps {
    selection: Selection
}

/**
 * GPU-rendered marching ants selection overlay using Pixi.js Graphics.
 * Animates the dash offset every frame for the classic "marching ants" effect.
 */
export default function SelectionOverlay({ selection }: SelectionOverlayProps) {
    const dashOffset = useRef(0)

    // Animate the dash offset for the marching ants effect
    useTick(useCallback(() => {
        dashOffset.current = (dashOffset.current + 0.5) % 16
    }, []))

    const draw = useCallback(
        (g: Graphics) => {
            g.clear()

            const { x, y, width, height, type } = selection
            if (width === 0 && height === 0) return

            const offset = dashOffset.current

            // Draw black solid outline (background)
            if (type === 'ellipse') {
                g.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2))
            } else {
                g.rect(x, y, width, height)
            }
            g.stroke({ width: 1, color: 0x000000, alpha: 0.7 })

            // Draw white dashed outline (foreground, animated)
            // We simulate dashes by drawing small line segments
            const dashLength = 4
            const gapLength = 4
            const strokeStyle = { width: 1, color: 0xffffff, alpha: 1 }

            if (type === 'ellipse') {
                // For ellipse, draw dashed segments along the perimeter
                const cx = x + width / 2
                const cy = y + height / 2
                const rx = Math.abs(width / 2)
                const ry = Math.abs(height / 2)
                const totalSteps = Math.max(64, Math.floor((rx + ry) * 0.8))
                const segmentAngle = (2 * Math.PI) / totalSteps
                let draw = true
                let stepInSegment = 0

                for (let i = 0; i < totalSteps; i++) {
                    const adjustedI = (i + Math.floor(offset)) % totalSteps
                    const angle1 = adjustedI * segmentAngle
                    const angle2 = (adjustedI + 1) * segmentAngle

                    if (draw) {
                        const px1 = cx + rx * Math.cos(angle1)
                        const py1 = cy + ry * Math.sin(angle1)
                        const px2 = cx + rx * Math.cos(angle2)
                        const py2 = cy + ry * Math.sin(angle2)
                        g.moveTo(px1, py1)
                        g.lineTo(px2, py2)
                    }

                    stepInSegment++
                    if (draw && stepInSegment >= dashLength) {
                        draw = false
                        stepInSegment = 0
                    } else if (!draw && stepInSegment >= gapLength) {
                        draw = true
                        stepInSegment = 0
                    }
                }
                g.stroke(strokeStyle)
            } else {
                // Rectangle: draw four edges with dashes
                const edges = [
                    [x, y, x + width, y],           // top
                    [x + width, y, x + width, y + height], // right
                    [x + width, y + height, x, y + height], // bottom
                    [x, y + height, x, y],           // left
                ]

                for (const [x1, y1, x2, y2] of edges) {
                    const dx = x2 - x1
                    const dy = y2 - y1
                    const edgeLen = Math.sqrt(dx * dx + dy * dy)
                    if (edgeLen === 0) continue

                    const ux = dx / edgeLen
                    const uy = dy / edgeLen
                    let pos = -offset % (dashLength + gapLength)

                    while (pos < edgeLen) {
                        const start = Math.max(0, pos)
                        const end = Math.min(edgeLen, pos + dashLength)
                        if (end > start && start < edgeLen) {
                            g.moveTo(x1 + ux * start, y1 + uy * start)
                            g.lineTo(x1 + ux * end, y1 + uy * end)
                        }
                        pos += dashLength + gapLength
                    }
                }
                g.stroke(strokeStyle)
            }
        },
        [selection, dashOffset.current]
    )

    return <pixiGraphics draw={draw} />
}
