import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, SlidersHorizontal, Check } from 'lucide-react'
import { useEditor, type LayerFilter } from './EditorContext'
import {
    buildPreviewFilterStack,
    FILTER_CATALOG,
    formatSliderValue,
    getDefaultFilterParams,
    getFilterCatalogEntry,
    isSupportedFilterType,
    type SupportedFilterType
} from '../data/filterCatalog'

interface FiltersDialogProps {
    initialFilterType?: LayerFilter['type']
    onClose: () => void
}

function cloneFilters(filters: LayerFilter[]): LayerFilter[] {
    return filters.map((filter) => ({
        ...filter,
        params: { ...filter.params }
    }))
}

function normalizeFilterType(type: LayerFilter['type']): SupportedFilterType {
    return isSupportedFilterType(type) ? type : 'blur'
}

export default function FiltersDialog({ initialFilterType = 'blur', onClose }: FiltersDialogProps) {
    const { activeLayerId, layers, setLayerFilters } = useEditor()
    const [selectedType, setSelectedType] = useState<SupportedFilterType>(() => normalizeFilterType(initialFilterType))
    const [hasSnapshot, setHasSnapshot] = useState(false)

    const committedRef = useRef(false)
    const originalLayerIdRef = useRef<string | null>(null)
    const originalFiltersRef = useRef<LayerFilter[]>([])

    const [draftParams, setDraftParams] = useState<Record<string, number>>(
        () => getDefaultFilterParams(normalizeFilterType(initialFilterType))
    )

    const activeLayer = layers.find((layer) => layer.id === activeLayerId)
    const selectedEntry = getFilterCatalogEntry(selectedType)

    useEffect(() => {
        if (!hasSnapshot && activeLayerId && activeLayer) {
            originalLayerIdRef.current = activeLayerId
            originalFiltersRef.current = cloneFilters(activeLayer.filters)
            setHasSnapshot(true)
        }
    }, [activeLayer, activeLayerId, hasSnapshot])

    useEffect(() => {
        if (!hasSnapshot) return
        const trackedLayerId = originalLayerIdRef.current
        if (!trackedLayerId) return
        const trackedLayerExists = layers.some((layer) => layer.id === trackedLayerId)
        if (!trackedLayerExists) {
            onClose()
        }
    }, [hasSnapshot, layers, onClose])

    const restoreOriginalFilters = useCallback(() => {
        if (committedRef.current) return
        if (!originalLayerIdRef.current) return
        setLayerFilters(originalLayerIdRef.current, originalFiltersRef.current, false)
    }, [setLayerFilters])

    const handleClose = useCallback(() => {
        restoreOriginalFilters()
        onClose()
    }, [onClose, restoreOriginalFilters])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                handleClose()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [handleClose])

    useEffect(() => {
        if (!hasSnapshot) return
        if (committedRef.current) return
        if (!originalLayerIdRef.current) return

        const previewFilters = buildPreviewFilterStack(
            originalFiltersRef.current,
            selectedType,
            draftParams
        )
        setLayerFilters(originalLayerIdRef.current, previewFilters, false)
    }, [draftParams, hasSnapshot, selectedType, setLayerFilters])

    useEffect(() => {
        return () => {
            restoreOriginalFilters()
        }
    }, [restoreOriginalFilters])

    if (!activeLayer) return null

    const handleApply = () => {
        if (!originalLayerIdRef.current) return
        const nextFilters = buildPreviewFilterStack(
            originalFiltersRef.current,
            selectedType,
            draftParams
        )
        setLayerFilters(originalLayerIdRef.current, nextFilters, true)
        committedRef.current = true
        onClose()
    }

    const updateParam = (key: string, value: number) => {
        setDraftParams((prev) => ({ ...prev, [key]: value }))
    }

    const handleSelectType = (type: SupportedFilterType) => {
        setSelectedType(type)
        setDraftParams(getDefaultFilterParams(type))
    }

    const sliderRows = useMemo(() => selectedEntry.sliders.map((slider) => {
        const value = draftParams[slider.key] ?? selectedEntry.defaultParams[slider.key] ?? 0
        return {
            ...slider,
            value
        }
    }), [draftParams, selectedEntry])

    return (
        <div className="filters-dock-container">
            <div
                className="filters-dialog filters-docked dialogue"
            >
                <div
                    className="dialogue-header"
                >
                    <span className="dialogue-title">
                        <SlidersHorizontal size={14} className="icon-blue" />
                        Adjustment Layers
                    </span>
                    <div className="dialogue-close" onClick={handleClose}>
                        <X size={14} />
                    </div>
                </div>

                <div className="filters-content">
                    <div className="filters-sidebar">
                        {FILTER_CATALOG.map((filter) => (
                            <div
                                key={filter.id}
                                className={`filter-type-item ${selectedType === filter.id ? 'active' : ''}`}
                                onClick={() => handleSelectType(filter.id)}
                            >
                                {filter.label}
                            </div>
                        ))}
                    </div>

                    <div className="filters-main">
                        <div className="filters-params-area">
                            <h3>{selectedEntry.label} Adjustments</h3>
                            {sliderRows.map((slider) => (
                                <div className="filter-slider-group" key={slider.key}>
                                    <div className="filter-slider-header">
                                        <span className="slider-label">{slider.label}</span>
                                        <span className="slider-value">
                                            {formatSliderValue(slider.value, slider.displayScale ?? 1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={slider.min}
                                        max={slider.max}
                                        step={slider.step ?? 0.01}
                                        value={slider.value}
                                        onChange={(e) => updateParam(slider.key, Number(e.target.value))}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="filters-preview-panel">
                            <div className="filters-preview-header">Live Preview</div>
                            <p className="filters-preview-text">
                                Changes are previewed directly on the canvas. Use Add Adjustment to commit or Close/Esc to discard.
                            </p>
                            <div className="filters-preview-pill">{selectedEntry.label}</div>
                            <div className="filters-preview-values">
                                {sliderRows.map((slider) => (
                                    <div key={slider.key} className="preview-value-row">
                                        <span>{slider.label}</span>
                                        <span>{formatSliderValue(slider.value, slider.displayScale ?? 1)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dialogue-footer">
                    <button className="pref-btn pref-btn-secondary" onClick={handleClose}>Close</button>
                    <button className="pref-btn pref-btn-primary" onClick={handleApply}>
                        <Check size={14} style={{ marginRight: 4 }} />
                        Add Adjustment
                    </button>
                </div>
            </div>
        </div>
    )
}
