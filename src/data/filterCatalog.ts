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
        label: 'Blur',
        menuLabel: 'Blur...',
        defaultParams: { strength: 4, quality: 4 },
        sliders: [
            { label: 'Strength', key: 'strength', min: 0, max: 40, step: 1 },
            { label: 'Quality', key: 'quality', min: 1, max: 10, step: 1 },
        ]
    },
    {
        id: 'brightness',
        label: 'Brightness',
        menuLabel: 'Brightness...',
        defaultParams: { value: 1 },
        sliders: [
            { label: 'Brightness', key: 'value', min: 0, max: 2, step: 0.05, displayScale: 100 },
        ]
    },
    {
        id: 'hue-saturation',
        label: 'Hue / Sat',
        menuLabel: 'Hue / Sat...',
        defaultParams: { hue: 0, saturation: 1 },
        sliders: [
            { label: 'Hue', key: 'hue', min: -180, max: 180, step: 1 },
            { label: 'Saturation', key: 'saturation', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'noise',
        label: 'Noise',
        menuLabel: 'Noise...',
        defaultParams: { noise: 0.5 },
        sliders: [
            { label: 'Amount', key: 'noise', min: 0, max: 1, step: 0.01, displayScale: 100 },
        ]
    },
    {
        id: 'color-matrix',
        label: 'Color Balance',
        menuLabel: 'Color Balance...',
        defaultParams: { contrast: 1, brightness: 1 },
        sliders: [
            { label: 'Contrast', key: 'contrast', min: 0, max: 2, step: 0.1 },
            { label: 'Brightness', key: 'brightness', min: 0, max: 2, step: 0.05 },
        ]
    },
    {
        id: 'pixelate',
        label: 'Pixelate',
        menuLabel: 'Pixelate...',
        defaultParams: { size: 10 },
        sliders: [
            { label: 'Size', key: 'size', min: 2, max: 50, step: 1 },
        ]
    },
    {
        id: 'glitch',
        label: 'Glitch',
        menuLabel: 'Glitch...',
        defaultParams: { slices: 5, offset: 100, direction: 0 },
        sliders: [
            { label: 'Slices', key: 'slices', min: 2, max: 20, step: 1 },
            { label: 'Offset', key: 'offset', min: 0, max: 200, step: 10 },
            { label: 'Direction', key: 'direction', min: 0, max: 180, step: 1 },
        ]
    },
    {
        id: 'old-film',
        label: 'Old Film',
        menuLabel: 'Old Film...',
        defaultParams: { sepia: 0.3, noise: 0.3, scratch: 0.5, vignetting: 0.3 },
        sliders: [
            { label: 'Sepia', key: 'sepia', min: 0, max: 1, step: 0.05 },
            { label: 'Noise', key: 'noise', min: 0, max: 1, step: 0.05 },
            { label: 'Scratch', key: 'scratch', min: 0, max: 1, step: 0.05 },
            { label: 'Vignette', key: 'vignetting', min: 0, max: 1, step: 0.05 },
        ]
    },
    {
        id: 'adjustment',
        label: 'Adjustment',
        menuLabel: 'Adjustment...',
        defaultParams: { gamma: 1, contrast: 1, brightness: 1, saturation: 1 },
        sliders: [
            { label: 'Gamma', key: 'gamma', min: 0, max: 5, step: 0.1 },
            { label: 'Contrast', key: 'contrast', min: 0, max: 5, step: 0.1 },
            { label: 'Brightness', key: 'brightness', min: 0, max: 5, step: 0.1 },
            { label: 'Saturation', key: 'saturation', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'ascii',
        label: 'ASCII',
        menuLabel: 'ASCII...',
        defaultParams: { size: 8 },
        sliders: [
            { label: 'Size', key: 'size', min: 2, max: 20, step: 1 },
        ]
    },
    {
        id: 'dot',
        label: 'Dot',
        menuLabel: 'Dot...',
        defaultParams: { scale: 1, angle: 5 },
        sliders: [
            { label: 'Scale', key: 'scale', min: 0.1, max: 2, step: 0.1 },
            { label: 'Angle', key: 'angle', min: 0, max: 360, step: 1 },
        ]
    },
    {
        id: 'emboss',
        label: 'Emboss',
        menuLabel: 'Emboss...',
        defaultParams: { strength: 5 },
        sliders: [
            { label: 'Strength', key: 'strength', min: 0, max: 20, step: 1 },
        ]
    },
    {
        id: 'cross-hatch',
        label: 'Cross Hatch',
        menuLabel: 'Cross Hatch...',
        defaultParams: {},
        sliders: []
    },
    {
        id: 'bulge-pinch',
        label: 'Bulge / Pinch',
        menuLabel: 'Bulge / Pinch...',
        defaultParams: { radius: 100, strength: 1, centerX: 0.5, centerY: 0.5 },
        sliders: [
            { label: 'Radius', key: 'radius', min: 0, max: 600, step: 10 },
            { label: 'Strength', key: 'strength', min: -1, max: 1, step: 0.1 },
            { label: 'Center X', key: 'centerX', min: 0, max: 1, step: 0.01 },
            { label: 'Center Y', key: 'centerY', min: 0, max: 1, step: 0.01 },
        ]
    },
    {
        id: 'twist',
        label: 'Twist',
        menuLabel: 'Twist...',
        defaultParams: { radius: 200, angle: 4, offsetX: 400, offsetY: 300 },
        sliders: [
            { label: 'Radius', key: 'radius', min: 0, max: 600, step: 10 },
            { label: 'Angle', key: 'angle', min: -10, max: 10, step: 0.1 },
            { label: 'Offset X', key: 'offsetX', min: 0, max: 2000, step: 10 },
            { label: 'Offset Y', key: 'offsetY', min: 0, max: 2000, step: 10 },
        ]
    },
    {
        id: 'reflection',
        label: 'Reflection',
        menuLabel: 'Reflection...',
        defaultParams: { mirror: 1, boundary: 0.5, amplitude: 20, waveLength: 100 },
        sliders: [
            { label: 'Mirror', key: 'mirror', min: 0, max: 1, step: 1 }, // simulate bool
            { label: 'Boundary', key: 'boundary', min: 0, max: 1, step: 0.01 },
            { label: 'Amplitude', key: 'amplitude', min: 0, max: 50, step: 1 },
            { label: 'Wave Len', key: 'waveLength', min: 10, max: 200, step: 5 },
        ]
    },
    {
        id: 'shockwave',
        label: 'Shockwave',
        menuLabel: 'Shockwave...',
        defaultParams: { radius: 160, centerX: 400, centerY: 300, amplitude: 30, wavelength: 100, speed: 500, time: 0.5 },
        sliders: [
            { label: 'Radius', key: 'radius', min: 0, max: 1000, step: 10 },
            { label: 'Center X', key: 'centerX', min: 0, max: 2000, step: 10 },
            { label: 'Center Y', key: 'centerY', min: 0, max: 2000, step: 10 },
            { label: 'Amplitude', key: 'amplitude', min: 0, max: 200, step: 5 },
            { label: 'Wavelength', key: 'wavelength', min: 10, max: 500, step: 10 },
            { label: 'Time', key: 'time', min: 0, max: 5, step: 0.01 },
        ]
    },
    {
        id: 'crt',
        label: 'CRT (TV)',
        menuLabel: 'CRT (TV)...',
        defaultParams: { curvature: 1, lineWidth: 1, lineContrast: 0.25, noise: 0.3, noiseSize: 1 },
        sliders: [
            { label: 'Curvature', key: 'curvature', min: 0, max: 10, step: 0.1 },
            { label: 'Line Width', key: 'lineWidth', min: 0, max: 10, step: 0.1 },
            { label: 'Contrast', key: 'lineContrast', min: 0, max: 1, step: 0.05 },
            { label: 'Noise', key: 'noise', min: 0, max: 1, step: 0.05 },
            { label: 'Size', key: 'noiseSize', min: 0, max: 10, step: 0.2 },
        ]
    },
    {
        id: 'rgb-split',
        label: 'RGB Split',
        menuLabel: 'RGB Split...',
        defaultParams: { redX: -10, redY: 0, greenX: 0, greenY: 10, blueX: 0, blueY: 0 },
        sliders: [
            { label: 'Red X', key: 'redX', min: -50, max: 50, step: 1 },
            { label: 'Red Y', key: 'redY', min: -50, max: 50, step: 1 },
            { label: 'Green X', key: 'greenX', min: -50, max: 50, step: 1 },
            { label: 'Green Y', key: 'greenY', min: -50, max: 50, step: 1 },
            { label: 'Blue X', key: 'blueX', min: -50, max: 50, step: 1 },
            { label: 'Blue Y', key: 'blueY', min: -50, max: 50, step: 1 },
        ]
    },
    {
        id: 'bloom',
        label: 'Bloom',
        menuLabel: 'Bloom...',
        defaultParams: { threshold: 0.5, bloomScale: 1, brightness: 1, blur: 8 },
        sliders: [
            { label: 'Threshold', key: 'threshold', min: 0, max: 1, step: 0.05 },
            { label: 'Scale', key: 'bloomScale', min: 0, max: 5, step: 0.1 },
            { label: 'Brightness', key: 'brightness', min: 0, max: 3, step: 0.1 },
            { label: 'Blur', key: 'blur', min: 0, max: 20, step: 1 },
        ]
    },
    {
        id: 'godray',
        label: 'Godray',
        menuLabel: 'Godray...',
        defaultParams: { angle: 30, gain: 0.5, lacunarity: 2.5 },
        sliders: [
            { label: 'Angle', key: 'angle', min: -45, max: 45, step: 1 },
            { label: 'Gain', key: 'gain', min: 0, max: 1, step: 0.05 },
            { label: 'Lacunarity', key: 'lacunarity', min: 0, max: 5, step: 0.1 },
        ]
    },
    {
        id: 'tilt-shift',
        label: 'Tilt Shift',
        menuLabel: 'Tilt Shift...',
        defaultParams: { blur: 15, gradientBlur: 600 },
        sliders: [
            { label: 'Blur', key: 'blur', min: 0, max: 50, step: 1 },
            { label: 'Gradient', key: 'gradientBlur', min: 0, max: 2000, step: 50 },
        ]
    },
    {
        id: 'zoom-blur',
        label: 'Zoom Blur',
        menuLabel: 'Zoom Blur...',
        defaultParams: { strength: 0.1, centerX: 400, centerY: 300, innerRadius: 0 },
        sliders: [
            { label: 'Strength', key: 'strength', min: 0, max: 1, step: 0.05 },
            { label: 'Center X', key: 'centerX', min: 0, max: 2000, step: 10 },
            { label: 'Center Y', key: 'centerY', min: 0, max: 2000, step: 10 },
            { label: 'Radius', key: 'innerRadius', min: 0, max: 500, step: 10 },
        ]
    },
    {
        id: 'motion-blur',
        label: 'Motion Blur',
        menuLabel: 'Motion Blur...',
        defaultParams: { velocityX: 15, velocityY: 15, kernelSize: 5, offset: 0 },
        sliders: [
            { label: 'Vel X', key: 'velocityX', min: -50, max: 50, step: 1 },
            { label: 'Vel Y', key: 'velocityY', min: -50, max: 50, step: 1 },
            { label: 'Kernel', key: 'kernelSize', min: 3, max: 25, step: 2 },
            { label: 'Offset', key: 'offset', min: -100, max: 100, step: 1 },
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
