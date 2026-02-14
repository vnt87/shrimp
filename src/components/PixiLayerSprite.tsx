import { useEffect, useMemo, useRef } from 'react'
import { extend } from '@pixi/react'
import {
    Sprite,
    Texture,
    BlurFilter,
    ColorMatrixFilter,
    NoiseFilter,
    type Filter
} from 'pixi.js'
import type { Layer, LayerFilter, TransformData } from './EditorContext'

// Register the Sprite component with @pixi/react
extend({ Sprite })

/**
 * Maps a Layer's string blendMode to a Pixi.js blend mode string.
 * Pixi v8 uses string-based blend modes.
 */
function mapBlendMode(mode: string): string {
    const blendMap: Record<string, string> = {
        'normal': 'normal',
        'multiply': 'multiply',
        'screen': 'screen',
        'overlay': 'overlay',
        'darken': 'darken',
        'lighten': 'lighten',
        'color-dodge': 'color-dodge',
        'color-burn': 'color-burn',
        'hard-light': 'hard-light',
        'soft-light': 'soft-light',
        'difference': 'difference',
        'exclusion': 'exclusion',
        'hue': 'hue',
        'saturation': 'saturation',
        'color': 'color',
        'luminosity': 'luminosity',
    }
    return blendMap[mode] || 'normal'
}

/**
 * Converts a LayerFilter descriptor into a Pixi.js Filter instance.
 */
function createPixiFilter(filter: LayerFilter): Filter | null {
    if (!filter.enabled) return null

    switch (filter.type) {
        case 'blur':
            return new BlurFilter({
                strength: filter.params.strength ?? 4,
                quality: filter.params.quality ?? 4,
            })
        case 'brightness': {
            const cm = new ColorMatrixFilter()
            cm.brightness(filter.params.value ?? 1, false)
            return cm
        }
        case 'hue-saturation': {
            const cm = new ColorMatrixFilter()
            if (filter.params.hue != null) cm.hue(filter.params.hue, false)
            if (filter.params.saturation != null) cm.saturate(filter.params.saturation, false)
            return cm
        }
        case 'noise':
            return new NoiseFilter({
                noise: filter.params.noise ?? 0.5,
            })
        case 'color-matrix': {
            const cm = new ColorMatrixFilter()
            if (filter.params.contrast != null) cm.contrast(filter.params.contrast, false)
            if (filter.params.brightness != null) cm.brightness(filter.params.brightness, false)
            return cm
        }
        default:
            return null
    }
}

interface PixiLayerSpriteProps {
    layer: Layer
    transform?: TransformData
}

/**
 * Renders a single editor layer as a Pixi.js Sprite with GPU-accelerated
 * blend modes and non-destructive filters.
 */
export default function PixiLayerSprite({ layer, transform }: PixiLayerSpriteProps) {
    const textureRef = useRef<Texture | null>(null)

    // ... (texture logic same)
    // Create texture from the layer's HTMLCanvasElement data
    const texture = useMemo(() => {
        if (textureRef.current) {
            textureRef.current.destroy(true)
        }
        if (!layer.data) {
            textureRef.current = null
            return Texture.EMPTY
        }
        const tex = Texture.from({ resource: layer.data, alphaMode: 'premultiply-alpha-on-upload' })
        textureRef.current = tex
        return tex
    }, [layer.data])

    // ... (useEffect for update same)
    // When layer.data canvas content changes (but the same canvas object),
    // we need to force texture update
    useEffect(() => {
        if (textureRef.current && layer.data) {
            textureRef.current.source.update()
        }
    }, [layer.data, layer.opacity])

    // ... (pixiFilters logic same)
    // Build the Pixi filter array from our LayerFilter descriptors
    const pixiFilters = useMemo(() => {
        if (!layer.filters || layer.filters.length === 0) return undefined
        const filters = layer.filters
            .map(createPixiFilter)
            .filter((f): f is Filter => f !== null)
        return filters.length > 0 ? filters : undefined
    }, [layer.filters])

    // ... (cleanup same)
    // Cleanup texture on unmount
    useEffect(() => {
        return () => {
            if (textureRef.current) {
                textureRef.current.destroy(true)
                textureRef.current = null
            }
        }
    }, [])

    if (!layer.visible || !layer.data) return null

    // Determine transform properties
    const x = transform ? transform.x : layer.x
    const y = transform ? transform.y : layer.y
    const scale = transform ? { x: transform.scaleX, y: transform.scaleY } : { x: 1, y: 1 }
    const rotation = transform ? transform.rotation : 0
    const skew = transform ? { x: transform.skewX, y: transform.skewY } : { x: 0, y: 0 }
    const pivot = transform ? { x: transform.pivotX, y: transform.pivotY } : { x: 0, y: 0 }

    return (
        <pixiSprite
            texture={texture}
            x={x}
            y={y}
            scale={scale}
            rotation={rotation}
            skew={skew}
            pivot={pivot}
            alpha={layer.opacity / 100}
            blendMode={mapBlendMode(layer.blendMode) as any}
            filters={pixiFilters}
        />
    )
}

