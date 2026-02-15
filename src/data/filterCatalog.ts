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
