import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Graphics, Container, Rectangle, Point, FederatedPointerEvent } from 'pixi.js'
import { useEditor, type TransformData } from './EditorContext'
import { useApplication } from '@pixi/react'

type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'lm' | 'rm' | 'rot' | 'move'

interface DragState {
    type: HandleType
    startLocal: Point      // Start pos in local space (relative to parent of object)
    // startGlobal: Point     // Start pos in global screen space
    initialTransform: TransformData
    center: Point          // Pivot/Center in local space
}

export default function TransformOverlay({ layerId }: { layerId: string }) {
    const { layers, transientTransforms, setTransientTransform, commitTransform } = useEditor()
    const { app } = useApplication()
    const layer = layers.find(l => l.id === layerId)

    // Local state for drag
    const dragState = useRef<DragState | null>(null)
    const containerRef = useRef<Container>(null)

    // Initialize transform keys
    const transform = useMemo(() => {
        if (transientTransforms[layerId]) {
            return transientTransforms[layerId]
        }
        // If not started, return identity-like based on layer
        if (!layer) return null
        return {
            x: layer.x,
            y: layer.y,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            skewX: 0,
            skewY: 0,
            pivotX: 0, // Pivot at 0,0 (top-left) by default for now? Or center?
            // Usually simpler to pivot at center for rotation.
            // Use center of the layer content.
            pivotY: 0
        }
    }, [transientTransforms, layerId, layer])

    useEffect(() => {
        if (!layer) return
        // If no transient transform exists, set one with center pivot to facilitate rotation
        if (!transientTransforms[layerId]) {
            const width = layer.data?.width || 0
            const height = layer.data?.height || 0
            const cx = width / 2
            const cy = height / 2

            // If we change pivot to center, we must shift (x,y) to compensate
            // Original: x, y, pivot=0,0
            // New: x' = x + cx, y' = y + cy, pivot=cx, cy

            setTransientTransform(layerId, {
                x: layer.x + cx,
                y: layer.y + cy,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                skewX: 0,
                skewY: 0,
                pivotX: cx,
                pivotY: cy
            })
        }
    }, [layerId, layer, transientTransforms, setTransientTransform])

    if (!transform || !layer || !layer.data) return null

    // Bounds in local non-transformed space (0,0 to w,h)
    // const localBounds = new Rectangle(0, 0, layer.data.width, layer.data.height)
    // Actually, because we shifted pivot to center, the content is from -pivotX to +pivotX?
    // In Pixi, `pivot` defines the point in the source that aligns with `position`.
    // If sprite is at (0,0) (local), it draws from -pivotX to width-pivotX.

    const w = layer.data.width
    const h = layer.data.height
    const px = transform.pivotX
    const py = transform.pivotY

    // Calculate handle positions in local unscaled/unrotated space (relative to pivot)
    // Top-Left relative to pivot: -px, -py
    // Bottom-Right relative to pivot: w-px, h-py
    const left = -px
    const top = -py
    const right = w - px
    const bottom = h - py

    // We can draw the handles in the same coordinate system as the layer (transformed),
    // OR we can calculate their world positions.
    // Putting handles INSIDE the transformed container is easiest: they rotate/scale WITH the object.
    // BUT we usually want handles to stay same visual size (10px).
    // If we put them inside, scaling the object scales the handles.
    // So usually handles are drawn in PARENT space (scene space), calculating positions manually.

    // Draw in PARENT space.
    // We need to map local points (corners) to parent space using the transform.

    const toParent = (lx: number, ly: number) => {
        // Apply transform: Rotate, Scale, Translate
        // x' = (x*sx*cos - y*sy*sin) + tx
        // y' = (x*sx*sin + y*sy*cos) + ty
        // inputs lx, ly are relative to pivot (which is at transform.x, transform.y)

        const sx = transform.scaleX
        const sy = transform.scaleY
        const r = transform.rotation
        const cos = Math.cos(r)
        const sin = Math.sin(r)

        const rx = lx * sx
        const ry = ly * sy

        return {
            x: (rx * cos - ry * sin) + transform.x,
            y: (rx * sin + ry * cos) + transform.y
        }
    }

    // Corners relative to pivot
    const pTL = toParent(left, top)
    const pTR = toParent(right, top)
    const pBL = toParent(left, bottom)
    const pBR = toParent(right, bottom)
    // const pTM = toParent(0, top) 
    // const pBM = toParent(0, bottom)
    // ... calculate mids properly
    const midX = (left + right) / 2
    const midY = (top + bottom) / 2

    // Actually, if pivot is center, left = -w/2, right = w/2. midX = 0.

    const handles = {
        tl: pTL,
        tr: pTR,
        bl: pBL,
        br: pBR,
        tm: toParent(midX, top),
        bm: toParent(midX, bottom),
        lm: toParent(left, midY),
        rm: toParent(right, midY),
        rot: toParent(midX, top - 30) // Rotation handle above top
    }

    const drawHandles = useCallback((g: Graphics) => {
        g.clear()

        // Draw bounding box
        g.moveTo(pTL.x, pTL.y)
        g.lineTo(pTR.x, pTR.y)
        g.lineTo(pBR.x, pBR.y)
        g.lineTo(pBL.x, pBL.y)
        g.lineTo(pTL.x, pTL.y)
        g.stroke({ width: 1, color: 0x5294e2 })

        // Draw connection to rot handle
        g.moveTo(handles.tm.x, handles.tm.y)
        g.lineTo(handles.rot.x, handles.rot.y)
        g.stroke({ width: 1, color: 0x5294e2 })

        // Draw handles
        const size = 8
        const drawSquare = (p: { x: number, y: number }) => {
            g.rect(p.x - size / 2, p.y - size / 2, size, size)
        }

        drawSquare(handles.tl)
        drawSquare(handles.tr)
        drawSquare(handles.bl)
        drawSquare(handles.br)
        drawSquare(handles.tm)
        drawSquare(handles.bm)
        drawSquare(handles.lm)
        drawSquare(handles.rm)

        g.fill(0xffffff)
        g.stroke({ width: 1, color: 0x5294e2 })

        // Rot handle (circle)
        g.circle(handles.rot.x, handles.rot.y, 5)
        g.fill(0xffffff)
        g.stroke({ width: 1, color: 0x5294e2 })

    }, [pTL, pTR, pBL, pBR, handles])

    // Interaction Logic
    const onDragStart = (type: HandleType, e: FederatedPointerEvent) => {
        e.stopPropagation()
        // const startGlobal = e.global.clone()
        // We capture initial transform state
        dragState.current = {
            type,
            // startGlobal,
            startLocal: e.getLocalPosition(containerRef.current?.parent || new Container()), // get pos in parent (scene) space
            initialTransform: { ...transform },
            center: new Point(transform.x, transform.y)
        }

        if (app?.stage) {
            app.stage.eventMode = 'static'
            app.stage.hitArea = app.screen
            app.stage.on('pointermove', onDragMove)
            app.stage.on('pointerup', onDragEnd)
            app.stage.on('pointerupoutside', onDragEnd)
        }
    }

    const onDragMove = (e: FederatedPointerEvent) => {
        if (!dragState.current) return

        const { type, initialTransform, center } = dragState.current

        if (!containerRef.current?.parent) return
        const currentLocal = e.getLocalPosition(containerRef.current.parent)
        const startLocal = dragState.current.startLocal

        const dx = currentLocal.x - startLocal.x
        const dy = currentLocal.y - startLocal.y

        let newTrans = { ...initialTransform }

        if (type === 'move') {
            newTrans.x = initialTransform.x + dx
            newTrans.y = initialTransform.y + dy
        } else if (type === 'rot') {
            const startAngle = Math.atan2(startLocal.y - center.y, startLocal.x - center.x)
            const currAngle = Math.atan2(currentLocal.y - center.y, currentLocal.x - center.x)

            const dAngle = currAngle - startAngle
            newTrans.rotation = initialTransform.rotation + dAngle
        } else {
            const cos = Math.cos(-initialTransform.rotation)
            const sin = Math.sin(-initialTransform.rotation)

            const relX = currentLocal.x - center.x
            const relY = currentLocal.y - center.y

            const startRelX = startLocal.x - center.x
            const startRelY = startLocal.y - center.y

            const uX = relX * cos - relY * sin
            const uY = relX * sin + relY * cos

            const hsX = startRelX * cos - startRelY * sin
            const hsY = startRelX * sin + startRelY * cos

            let sx = initialTransform.scaleX
            let sy = initialTransform.scaleY

            if (type.includes('r')) { // Right
                if (Math.abs(hsX) > 0.1) sx = initialTransform.scaleX * (uX / hsX)
            }
            if (type.includes('l')) { // Left
                if (Math.abs(hsX) > 0.1) sx = initialTransform.scaleX * (uX / hsX)
            }
            if (type.includes('b')) { // Bottom
                if (Math.abs(hsY) > 0.1) sy = initialTransform.scaleY * (uY / hsY)
            }
            if (type.includes('t')) { // Top
                if (Math.abs(hsY) > 0.1) sy = initialTransform.scaleY * (uY / hsY)
            }

            newTrans.scaleX = sx
            newTrans.scaleY = sy
        }

        setTransientTransform(layerId, newTrans)
    }

    const onDragEnd = () => {
        dragState.current = null
        if (app?.stage) {
            app.stage.off('pointermove', onDragMove)
            app.stage.off('pointerup', onDragEnd)
            app.stage.off('pointerupoutside', onDragEnd)
        }
    }

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                commitTransform(layerId, transform)
            } else if (e.key === 'Escape') {
                setTransientTransform(layerId, null) // Cancel
            }
        }
        window.addEventListener('keydown', handleKeys)
        return () => window.removeEventListener('keydown', handleKeys)
    }, [layerId, transform, commitTransform, setTransientTransform])


    const HitHandle = ({ type, p }: { type: HandleType, p: { x: number, y: number } }) => (
        <graphics
            x={p.x}
            y={p.y}
            interactive={true}
            cursor={getCursor(type, transform.rotation)}
            hitArea={new Rectangle(-6, -6, 12, 12)}
            draw={(g) => {
                g.clear()
                g.rect(-6, -6, 12, 12)
                g.fill({ color: 0x000000, alpha: 0.01 })
            }}
            onPointerDown={(e: any) => onDragStart(type, e)}
        />
    )

    return (
        <container ref={containerRef}>
            <graphics draw={drawHandles} />

            <graphics
                x={transform.x}
                y={transform.y}
                scale={{ x: transform.scaleX, y: transform.scaleY }}
                rotation={transform.rotation}
                pivot={{ x: transform.pivotX, y: transform.pivotY }}
                skew={{ x: transform.skewX, y: transform.skewY }}
                interactive={true}
                cursor="move"
                draw={(g) => {
                    g.clear()
                    g.rect(0, 0, w, h)
                    g.fill({ color: 0xffffff, alpha: 0.01 })
                }}
                onPointerDown={(e: any) => onDragStart('move', e)}
            />

            <HitHandle type="tl" p={handles.tl} />
            <HitHandle type="tr" p={handles.tr} />
            <HitHandle type="bl" p={handles.bl} />
            <HitHandle type="br" p={handles.br} />
            <HitHandle type="tm" p={handles.tm} />
            <HitHandle type="bm" p={handles.bm} />
            <HitHandle type="lm" p={handles.lm} />
            <HitHandle type="rm" p={handles.rm} />
            <HitHandle type="rot" p={handles.rot} />

        </container>
    )
}

function getCursor(type: HandleType, _rotation: number): string {
    // Return appropriate CSS cursor based on handle type + rotation
    // Simplified for MVP
    if (type === 'move') return 'move'
    if (type === 'rot') return 'grabbing'

    // Map standard (nw, ne, etc)
    // TODO: adjust based on rotation
    switch (type) {
        case 'tl': return 'nw-resize'
        case 'tr': return 'ne-resize'
        case 'bl': return 'sw-resize'
        case 'br': return 'se-resize'
        case 'tm': return 'n-resize'
        case 'bm': return 's-resize'
        case 'lm': return 'w-resize'
        case 'rm': return 'e-resize'
    }
    return 'default'
}
