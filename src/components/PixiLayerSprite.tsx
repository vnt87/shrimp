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
import {
    PixelateFilter,
    GlitchFilter,
    AdjustmentFilter,
    OldFilmFilter,
    AsciiFilter,
    DotFilter,
    EmbossFilter,
    CrossHatchFilter,
    BulgePinchFilter,
    TwistFilter,
    ReflectionFilter,
    ShockwaveFilter,
    CRTFilter,
    RGBSplitFilter,
    AdvancedBloomFilter,
    GodrayFilter,
    TiltShiftFilter,
    ZoomBlurFilter,
    MotionBlurFilter
} from 'pixi-filters'
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
        case 'pixelate':
            // @ts-ignore
            return new PixelateFilter(filter.params.size ?? 10)
        case 'glitch':
            // @ts-ignore
            return new GlitchFilter({
                slices: filter.params.slices ?? 5,
                offset: filter.params.offset ?? 100,
                direction: filter.params.direction ?? 0,
                fillMode: filter.params.fillMode ?? 0,
                seed: filter.params.seed ?? 0,
                average: false,
                minSize: 8,
                sampleSize: 512,
            })
        case 'old-film':
            // @ts-ignore
            return new OldFilmFilter({
                sepia: filter.params.sepia ?? 0.3,
                noise: filter.params.noise ?? 0.3,
                noiseSize: filter.params.noiseSize ?? 1.0,
                scratch: filter.params.scratch ?? 0.5,
                scratchDensity: filter.params.scratchDensity ?? 0.3,
                scratchWidth: filter.params.scratchWidth ?? 1.0,
                vignetting: filter.params.vignetting ?? 0.3,
                vignettingAlpha: filter.params.vignettingAlpha ?? 1.0,
                vignettingBlur: filter.params.vignettingBlur ?? 0.3,
            })
        case 'adjustment':
            // @ts-ignore
            return new AdjustmentFilter({
                gamma: filter.params.gamma ?? 1,
                contrast: filter.params.contrast ?? 1,
                saturation: filter.params.saturation ?? 1,
                brightness: filter.params.brightness ?? 1,
                red: filter.params.red ?? 1,
                green: filter.params.green ?? 1,
                blue: filter.params.blue ?? 1,
                alpha: filter.params.alpha ?? 1,
            })
        case 'ascii':
            // @ts-ignore
            return new AsciiFilter({ size: filter.params.size ?? 8 })
        case 'dot':
            // @ts-ignore
            return new DotFilter({
                scale: filter.params.scale ?? 1,
                angle: filter.params.angle ?? 5,
            })
        case 'emboss':
            // @ts-ignore
            return new EmbossFilter({ strength: filter.params.strength ?? 5 })
        case 'cross-hatch':
            // @ts-ignore
            return new CrossHatchFilter()
        case 'bulge-pinch':
            // @ts-ignore
            return new BulgePinchFilter({
                radius: filter.params.radius ?? 100,
                strength: filter.params.strength ?? 1,
                center: { x: filter.params.centerX ?? 0.5, y: filter.params.centerY ?? 0.5 },
            })
        case 'twist':
            // @ts-ignore
            return new TwistFilter({
                radius: filter.params.radius ?? 200,
                angle: filter.params.angle ?? 4,
                offset: { x: filter.params.offsetX ?? 400, y: filter.params.offsetY ?? 300 },
            })
        case 'reflection':
            // @ts-ignore
            return new ReflectionFilter({
                mirror: (filter.params.mirror ?? 1) > 0.5,
                boundary: filter.params.boundary ?? 0.5,
                amplitude: [0, filter.params.amplitude ?? 20],
                waveLength: [30, filter.params.waveLength ?? 100],
                alpha: [1, 1],
                time: 0 // We might need to animate this later
            })
        case 'shockwave':
            // @ts-ignore
            return new ShockwaveFilter({
                center: { x: filter.params.centerX ?? 400, y: filter.params.centerY ?? 300 },
                radius: filter.params.radius ?? 160,
                wavelength: filter.params.wavelength ?? 65,
                amplitude: filter.params.amplitude ?? 105,
                speed: filter.params.speed ?? 500,
                time: filter.params.time ?? 0
            })
        case 'crt':
            // @ts-ignore
            return new CRTFilter({
                curvature: filter.params.curvature ?? 1,
                lineWidth: filter.params.lineWidth ?? 1,
                lineContrast: filter.params.lineContrast ?? 0.25,
                noise: filter.params.noise ?? 0.3,
                noiseSize: filter.params.noiseSize ?? 1,
            })
        case 'rgb-split':
            // @ts-ignore
            return new RGBSplitFilter({
                red: { x: filter.params.redX ?? -10, y: filter.params.redY ?? 0 },
                green: { x: filter.params.greenX ?? 0, y: filter.params.greenY ?? 10 },
                blue: { x: filter.params.blueX ?? 0, y: filter.params.blueY ?? 0 },
            })
        case 'bloom':
            // @ts-ignore
            return new AdvancedBloomFilter({
                threshold: filter.params.threshold ?? 0.5,
                bloomScale: filter.params.bloomScale ?? 1.0,
                brightness: filter.params.brightness ?? 1.0,
                blur: filter.params.blur ?? 8,
                quality: filter.params.quality ?? 4,
            })
        case 'godray':
            // @ts-ignore
            return new GodrayFilter({
                angle: filter.params.angle ?? 30,
                gain: filter.params.gain ?? 0.5,
                lacunarity: filter.params.lacunarity ?? 2.5,
            })
        case 'tilt-shift':
            // @ts-ignore
            return new TiltShiftFilter({
                blur: filter.params.blur ?? 15,
                gradientBlur: filter.params.gradientBlur ?? 600,
            })
        case 'zoom-blur':
            // @ts-ignore
            return new ZoomBlurFilter({
                strength: filter.params.strength ?? 0.1,
                center: { x: filter.params.centerX ?? 400, y: filter.params.centerY ?? 300 },
                innerRadius: filter.params.innerRadius ?? 0,
            })
        case 'motion-blur':
            // @ts-ignore
            return new MotionBlurFilter({
                velocity: { x: filter.params.velocityX ?? 0, y: filter.params.velocityY ?? 0 },
                kernelSize: filter.params.kernelSize ?? 15,
                offset: filter.params.offset ?? 0,
            })
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
    // Also listen to renderVersion for explicit update triggers
    useEffect(() => {
        if (textureRef.current && layer.data) {
            textureRef.current.source.update()
        }
    }, [layer.data, layer.opacity, layer.renderVersion])

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

