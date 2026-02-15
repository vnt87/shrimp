import { describe, expect, it } from 'vitest'
import {
    buildPreviewFilterStack,
    FILTER_CATALOG,
    getDefaultFilterParams,
    isSupportedFilterType
} from './filterCatalog'

describe('filterCatalog integrity', () => {
    it('has unique ids and valid menu mappings', () => {
        const ids = FILTER_CATALOG.map((entry) => entry.id)
        const uniqueIds = new Set(ids)

        expect(uniqueIds.size).toBe(ids.length)
        for (const entry of FILTER_CATALOG) {
            expect(isSupportedFilterType(entry.id)).toBe(true)
            expect(entry.defaultParams).toBeTruthy()
            expect(Object.keys(entry.defaultParams).length).toBeGreaterThan(0)
            expect(entry.menuLabel.trim().length).toBeGreaterThan(0)
        }
    })
})

describe('filter preview assembly', () => {
    it('appends draft preview filter onto base stack', () => {
        const base = [
            {
                type: 'noise' as const,
                enabled: true,
                params: { noise: 0.2 }
            }
        ]

        const stack = buildPreviewFilterStack(base, 'blur', { strength: 12 })
        expect(stack).toHaveLength(2)
        expect(stack[0]).toEqual(base[0])
        expect(stack[1]).toMatchObject({
            type: 'blur',
            enabled: true,
            params: {
                strength: 12,
                quality: 4
            }
        })
    })

    it('returns new default params when switching filter type', () => {
        const blurDefaults = getDefaultFilterParams('blur')
        blurDefaults.strength = 999

        const hueSatDefaults = getDefaultFilterParams('hue-saturation')
        const blurDefaultsAgain = getDefaultFilterParams('blur')

        expect(hueSatDefaults).toEqual({ hue: 0, saturation: 1 })
        expect(blurDefaultsAgain).toEqual({ strength: 4, quality: 4 })
    })
})
