import type { LayerFilter } from '../components/EditorContext'

export type SupportedFilterType = Exclude<LayerFilter['type'], 'custom'>

export interface FilterSliderConfig {
    key: string
    label: string
    min: number
    max: number
    step?: number
    displayScale?: number
}

export interface FilterCatalogEntry {
    id: SupportedFilterType
    label: string
    menuLabel: string
    defaultParams: Record<string, number>
    sliders: FilterSliderConfig[]
}

export const FILTER_CATALOG: FilterCatalogEntry[] = [
    {
        id: 'blur',
        label: 'filter.blur',
        menuLabel: 'filter.blur',
        defaultParams: { strength: 4, quality: 4 },
        sliders: [
            { label: 'filter.param.strength', key: 'strength', min: 0, max: 40, step: 1 },
            { label: 'filter.param.quality', key: 'quality', min: 1, max: 10, step: 1 },
        ]
    },
    {
        id: 'brightness',
        label: 'filter.brightness',
        menuLabel: 'filter.brightness',
        defaultParams: { value: 1 },
        sliders: [
            { label: 'filter.param.brightness', key: 'value', min: 0, max: 2, step: 0.05, displayScale: 100 },
        ]
    },
    {
        id: 'hue-saturation',
        label: 'filter.hue_saturation',
        menuLabel: 'filter.hue_saturation',
        defaultParams: { hue: 0, saturation: 1 },
        sliders: [
            { label: 'filter.param.hue', key: 'hue', min: -180, max: 180, step: 1 },
            { label: 'filter.param.saturation', key: 'saturation', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'noise',
        label: 'filter.noise',
        menuLabel: 'filter.noise',
        defaultParams: { noise: 0.5 },
        sliders: [
            { label: 'filter.param.amount', key: 'noise', min: 0, max: 1, step: 0.01, displayScale: 100 },
        ]
    },
    {
        id: 'color-matrix',
        label: 'filter.color_balance',
        menuLabel: 'filter.color_balance',
        defaultParams: { contrast: 1, brightness: 1 },
        sliders: [
            { label: 'filter.param.contrast', key: 'contrast', min: 0, max: 2, step: 1, displayScale: 100 },
            { label: 'filter.param.brightness', key: 'brightness', min: 0, max: 2, step: 0.05, displayScale: 100 },
        ]
    },
    {
        id: 'pixelate',
        label: 'filter.pixelate',
        menuLabel: 'filter.pixelate',
        defaultParams: { size: 10 },
        sliders: [
            { label: 'filter.param.size', key: 'size', min: 2, max: 50, step: 1 },
        ]
    },
    {
        id: 'glitch',
        label: 'filter.glitch',
        menuLabel: 'filter.glitch',
        defaultParams: { slices: 5, offset: 100, direction: 0 },
        sliders: [
            { label: 'filter.param.slices', key: 'slices', min: 2, max: 20, step: 1 },
            { label: 'filter.param.offset', key: 'offset', min: 0, max: 200, step: 10 },
            { label: 'filter.param.direction', key: 'direction', min: 0, max: 180, step: 1 },
        ]
    },
    {
        id: 'old-film',
        label: 'filter.old_film',
        menuLabel: 'filter.old_film',
        defaultParams: { sepia: 0.3, noise: 0.3, scratch: 0.5, vignetting: 0.3 },
        sliders: [
            { label: 'filter.param.sepia', key: 'sepia', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.amount', key: 'noise', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.scratch', key: 'scratch', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.vignette', key: 'vignetting', min: 0, max: 1, step: 0.05 },
        ]
    },
    {
        id: 'adjustment',
        label: 'filter.adjustment',
        menuLabel: 'filter.adjustment',
        defaultParams: { gamma: 1, contrast: 1, brightness: 1, saturation: 1 },
        sliders: [
            { label: 'filter.param.gamma', key: 'gamma', min: 0, max: 5, step: 0.1 },
            { label: 'filter.param.contrast', key: 'contrast', min: 0, max: 5, step: 0.1 },
            { label: 'filter.param.brightness', key: 'brightness', min: 0, max: 5, step: 0.1 },
            { label: 'filter.param.saturation', key: 'saturation', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'ascii',
        label: 'filter.ascii',
        menuLabel: 'filter.ascii',
        defaultParams: { size: 8 },
        sliders: [
            { label: 'filter.param.size', key: 'size', min: 2, max: 20, step: 1 },
        ]
    },
    {
        id: 'dot',
        label: 'filter.dot',
        menuLabel: 'filter.dot',
        defaultParams: { scale: 1, angle: 5 },
        sliders: [
            { label: 'filter.param.scale', key: 'scale', min: 0.1, max: 2, step: 0.1 },
            { label: 'filter.param.angle', key: 'angle', min: 0, max: 360, step: 1 },
        ]
    },
    {
        id: 'emboss',
        label: 'filter.emboss',
        menuLabel: 'filter.emboss',
        defaultParams: { strength: 5 },
        sliders: [
            { label: 'filter.param.strength', key: 'strength', min: 0, max: 20, step: 1 },
        ]
    },
    {
        id: 'cross-hatch',
        label: 'filter.cross_hatch',
        menuLabel: 'filter.cross_hatch',
        defaultParams: {},
        sliders: []
    },
    {
        id: 'bulge-pinch',
        label: 'filter.bulge_pinch',
        menuLabel: 'filter.bulge_pinch',
        defaultParams: { radius: 100, strength: 1, centerX: 0.5, centerY: 0.5 },
        sliders: [
            { label: 'filter.param.radius', key: 'radius', min: 0, max: 600, step: 10 },
            { label: 'filter.param.strength', key: 'strength', min: -1, max: 1, step: 0.1 },
            { label: 'filter.param.centerX', key: 'centerX', min: 0, max: 1, step: 0.01 },
            { label: 'filter.param.centerY', key: 'centerY', min: 0, max: 1, step: 0.01 },
        ]
    },
    {
        id: 'twist',
        label: 'filter.twist',
        menuLabel: 'filter.twist',
        defaultParams: { radius: 200, angle: 4, offsetX: 400, offsetY: 300 },
        sliders: [
            { label: 'filter.param.radius', key: 'radius', min: 0, max: 600, step: 10 },
            { label: 'filter.param.angle', key: 'angle', min: -10, max: 10, step: 0.1 },
            { label: 'filter.param.offset', key: 'offsetX', min: 0, max: 2000, step: 10 },
            { label: 'filter.param.offset', key: 'offsetY', min: 0, max: 2000, step: 10 },
        ]
    },
    {
        id: 'reflection',
        label: 'filter.reflection',
        menuLabel: 'filter.reflection',
        defaultParams: { mirror: 1, boundary: 0.5, amplitude: 20, waveLength: 100 },
        sliders: [
            { label: 'filter.param.mirror', key: 'mirror', min: 0, max: 1, step: 1 },
            { label: 'filter.param.boundary', key: 'boundary', min: 0, max: 1, step: 0.01 },
            { label: 'filter.param.amplitude', key: 'amplitude', min: 0, max: 50, step: 1 },
            { label: 'filter.param.waveLength', key: 'waveLength', min: 10, max: 200, step: 5 },
        ]
    },
    {
        id: 'shockwave',
        label: 'filter.shockwave',
        menuLabel: 'filter.shockwave',
        defaultParams: { radius: 160, centerX: 400, centerY: 300, amplitude: 30, wavelength: 100, speed: 500, time: 0.5 },
        sliders: [
            { label: 'filter.param.radius', key: 'radius', min: 0, max: 1000, step: 10 },
            { label: 'filter.param.centerX', key: 'centerX', min: 0, max: 2000, step: 10 },
            { label: 'filter.param.centerY', key: 'centerY', min: 0, max: 2000, step: 10 },
            { label: 'filter.param.amplitude', key: 'amplitude', min: 0, max: 200, step: 5 },
            { label: 'filter.param.waveLength', key: 'wavelength', min: 10, max: 500, step: 10 },
            { label: 'filter.param.time', key: 'time', min: 0, max: 5, step: 0.01 },
        ]
    },
    {
        id: 'crt',
        label: 'filter.crt',
        menuLabel: 'filter.crt',
        defaultParams: { curvature: 1, lineWidth: 1, lineContrast: 0.25, noise: 0.3, noiseSize: 1 },
        sliders: [
            { label: 'filter.param.curvature', key: 'curvature', min: 0, max: 10, step: 0.1 },
            { label: 'filter.param.lineWidth', key: 'lineWidth', min: 0, max: 10, step: 0.1 },
            { label: 'filter.param.contrast', key: 'lineContrast', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.amount', key: 'noise', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.size', key: 'noiseSize', min: 0, max: 10, step: 0.2 },
        ]
    },
    {
        id: 'rgb-split',
        label: 'filter.rgb_split',
        menuLabel: 'filter.rgb_split',
        defaultParams: { redX: -10, redY: 0, greenX: 0, greenY: 10, blueX: 0, blueY: 0 },
        sliders: [
            { label: 'filter.param.redX', key: 'redX', min: -50, max: 50, step: 1 },
            { label: 'filter.param.redY', key: 'redY', min: -50, max: 50, step: 1 },
            { label: 'filter.param.greenX', key: 'greenX', min: -50, max: 50, step: 1 },
            { label: 'filter.param.greenY', key: 'greenY', min: -50, max: 50, step: 1 },
            { label: 'filter.param.blueX', key: 'blueX', min: -50, max: 50, step: 1 },
            { label: 'filter.param.blueY', key: 'blueY', min: -50, max: 50, step: 1 },
        ]
    },
    {
        id: 'bloom',
        label: 'filter.bloom',
        menuLabel: 'filter.bloom',
        defaultParams: { threshold: 0.5, bloomScale: 1, brightness: 1, blur: 8 },
        sliders: [
            { label: 'filter.param.threshold', key: 'threshold', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.scale', key: 'bloomScale', min: 0, max: 5, step: 0.1 },
            { label: 'filter.param.brightness', key: 'brightness', min: 0, max: 3, step: 0.1 },
            { label: 'filter.param.blur', key: 'blur', min: 0, max: 20, step: 1 },
        ]
    },
    {
        id: 'godray',
        label: 'filter.godray',
        menuLabel: 'filter.godray',
        defaultParams: { angle: 30, gain: 0.5, lacunarity: 2.5 },
        sliders: [
            { label: 'filter.param.angle', key: 'angle', min: -45, max: 45, step: 1 },
            { label: 'filter.param.gain', key: 'gain', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.lacunarity', key: 'lacunarity', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'tilt-shift',
        label: 'filter.tilt_shift',
        menuLabel: 'filter.tilt_shift',
        defaultParams: { blur: 15, gradientBlur: 600 },
        sliders: [
            { label: 'filter.param.blur', key: 'blur', min: 0, max: 50, step: 1 },
            { label: 'filter.param.offset', key: 'gradientBlur', min: 0, max: 2000, step: 50 },
        ]
    },
    {
        id: 'zoom-blur',
        label: 'filter.zoom_blur',
        menuLabel: 'filter.zoom_blur',
        defaultParams: { strength: 0.1, centerX: 400, centerY: 300, innerRadius: 0 },
        sliders: [
            { label: 'filter.param.strength', key: 'strength', min: 0, max: 1, step: 0.05 },
            { label: 'filter.param.centerX', key: 'centerX', min: 0, max: 2000, step: 10 },
            { label: 'filter.param.centerY', key: 'centerY', min: 0, max: 2000, step: 10 },
            { label: 'filter.param.radius', key: 'innerRadius', min: 0, max: 500, step: 10 },
        ]
    },
    {
        id: 'motion-blur',
        label: 'filter.motion_blur',
        menuLabel: 'filter.motion_blur',
        defaultParams: { velocityX: 15, velocityY: 15, kernelSize: 5, offset: 0 },
        sliders: [
            { label: 'filter.param.velocityX', key: 'velocityX', min: -50, max: 50, step: 1 },
            { label: 'filter.param.velocityY', key: 'velocityY', min: -50, max: 50, step: 1 },
            { label: 'filter.param.kernelSize', key: 'kernelSize', min: 3, max: 25, step: 2 },
            { label: 'filter.param.offset', key: 'offset', min: -100, max: 100, step: 1 },
        ]
    }
]

const FILTER_CATALOG_MAP: Record<SupportedFilterType, FilterCatalogEntry> = FILTER_CATALOG.reduce(
    (acc, entry) => {
        acc[entry.id] = entry
        return acc
    },
    {} as Record<SupportedFilterType, FilterCatalogEntry>
)

export function isSupportedFilterType(type: LayerFilter['type']): type is SupportedFilterType {
    return type !== 'custom' && type in FILTER_CATALOG_MAP
}

export function getFilterCatalogEntry(type: LayerFilter['type']): FilterCatalogEntry {
    return FILTER_CATALOG_MAP[isSupportedFilterType(type) ? type : 'blur']
}

export function getDefaultFilterParams(type: LayerFilter['type']): Record<string, number> {
    return { ...getFilterCatalogEntry(type).defaultParams }
}

export function createPreviewFilter(type: LayerFilter['type'], params: Record<string, number>): LayerFilter {
    const entry = getFilterCatalogEntry(type)
    return {
        type: entry.id,
        enabled: true,
        params: { ...entry.defaultParams, ...params }
    }
}

export function buildPreviewFilterStack(
    baseFilters: LayerFilter[],
    type: LayerFilter['type'],
    params: Record<string, number>
): LayerFilter[] {
    const previewFilter = createPreviewFilter(type, params)
    return [
        ...baseFilters.map((filter) => ({
            ...filter,
            params: { ...filter.params }
        })),
        previewFilter
    ]
}

export function formatSliderValue(rawValue: number, displayScale: number = 1): number {
    return Math.round(rawValue * displayScale * 10) / 10
}
