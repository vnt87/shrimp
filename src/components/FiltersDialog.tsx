import { useState, useEffect, useRef } from 'react'
import { X, SlidersHorizontal, Eye, EyeOff, Trash2, Check } from 'lucide-react'
import { useEditor, type LayerFilter } from './EditorContext'

interface FiltersDialogProps {
    initialFilterType?: LayerFilter['type']
    onClose: () => void
}

const filterTypes: { id: LayerFilter['type']; label: string }[] = [
    { id: 'blur', label: 'Blur' },
    { id: 'brightness', label: 'Brightness' },
    { id: 'hue-saturation', label: 'Hue / Sat' },
    { id: 'noise', label: 'Noise' },
    { id: 'color-matrix', label: 'Color Balance' },
]

const defaultParams: Record<LayerFilter['type'], Record<string, number>> = {
    'blur': { strength: 4, quality: 4 },
    'brightness': { value: 1 },
    'hue-saturation': { hue: 0, saturation: 1 },
    'noise': { noise: 0.5 },
    'color-matrix': { contrast: 1, brightness: 1 },
    'custom': {}
}

export default function FiltersDialog({ initialFilterType = 'blur', onClose }: FiltersDialogProps) {
    const { activeLayerId, layers, addFilter, removeFilter, toggleFilter } = useEditor()
    const [selectedType, setSelectedType] = useState<LayerFilter['type']>(initialFilterType)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const dragStart = useRef({ x: 0, y: 0 })

    // Draft params for the new filter we might add
    const [draftParams, setDraftParams] = useState<Record<string, number>>({ ...defaultParams[initialFilterType] })

    // Update draft params when switching types
    useEffect(() => {
        setDraftParams({ ...defaultParams[selectedType] })
    }, [selectedType])

    const activeLayer = layers.find(l => l.id === activeLayerId)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }))
            dragStart.current = { x: e.clientX, y: e.clientY }
        }

        const handleMouseUp = () => {
            isDragging.current = false
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    if (!activeLayer) return null

    const handleApply = () => {
        if (!activeLayerId) return
        addFilter(activeLayerId, {
            type: selectedType,
            enabled: true,
            params: draftParams
        })
        onClose()
    }

    const updateParam = (key: string, value: number) => {
        setDraftParams(prev => ({ ...prev, [key]: value }))
    }

    const renderSlider = (label: string, key: string, min: number, max: number, step: number = 0.01, displayScale: number = 1) => (
        <div className="filter-slider-group" key={key}>
            <div className="filter-slider-header">
                <span className="slider-label">{label}</span>
                <span className="slider-value">{Math.round((draftParams[key] ?? 0) * displayScale * 10) / 10}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={draftParams[key] ?? 0}
                onChange={(e) => updateParam(key, Number(e.target.value))}
            />
        </div>
    )

    const renderParams = () => {
        switch (selectedType) {
            case 'blur':
                return (
                    <>
                        {renderSlider('Strength', 'strength', 0, 40, 1)}
                        {renderSlider('Quality', 'quality', 1, 10, 1)}
                    </>
                )
            case 'brightness':
                return (
                    <>
                        {renderSlider('Brightness', 'value', 0, 2, 0.05, 100)}
                    </>
                )
            case 'hue-saturation':
                return (
                    <>
                        {renderSlider('Hue', 'hue', -180, 180, 1)}
                        {renderSlider('Saturation', 'saturation', 0, 5, 0.1)}
                    </>
                )
            case 'noise':
                return (
                    <>
                        {renderSlider('Amount', 'noise', 0, 1, 0.01, 100)}
                    </>
                )
            case 'color-matrix':
                return (
                    <>
                        {renderSlider('Contrast', 'contrast', 0, 2, 0.1)}
                        {renderSlider('Brightness', 'brightness', 0, 2, 0.05)}
                    </>
                )
            default:
                return null
        }
    }

    return (
        <div className="dialog-overlay">
            <div
                className="filters-dialog dialogue"
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            >
                <div
                    className="dialogue-header"
                    onMouseDown={(e) => {
                        isDragging.current = true
                        dragStart.current = { x: e.clientX, y: e.clientY }
                    }}
                    style={{ cursor: 'move' }}
                >
                    <span className="dialogue-title">
                        <SlidersHorizontal size={14} className="icon-blue" />
                        Filters
                    </span>
                    <div className="dialogue-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                <div className="filters-content">
                    {/* Left: Filter Type Selection */}
                    <div className="filters-sidebar">
                        {filterTypes.map(ft => (
                            <div
                                key={ft.id}
                                className={`filter-type-item ${selectedType === ft.id ? 'active' : ''}`}
                                onClick={() => setSelectedType(ft.id)}
                            >
                                {ft.label}
                            </div>
                        ))}
                    </div>

                    {/* Right: Params & Preview */}
                    <div className="filters-main">
                        <div className="filters-params-area">
                            <h3>{filterTypes.find(t => t.id === selectedType)?.label} Settings</h3>
                            {renderParams()}
                        </div>

                        {/* Existing Filters List on Layer */}
                        <div className="filters-existing-list">
                            <div className="filters-list-header">
                                <span>Active Filters ({activeLayer.filters.length})</span>
                            </div>
                            {activeLayer.filters.length === 0 ? (
                                <div className="empty-filters">No filters applied to active layer</div>
                            ) : (
                                <div className="filters-list">
                                    {activeLayer.filters.map((filter, idx) => (
                                        <div key={idx} className="filter-item">
                                            <div className="filter-item-info">
                                                <div className="filter-stripe"></div>
                                                <span className="filter-name">
                                                    {filterTypes.find(t => t.id === filter.type)?.label || filter.type}
                                                </span>
                                            </div>
                                            <div className="filter-actions">
                                                <button
                                                    className={`filter-action-btn ${filter.enabled ? '' : 'disabled'}`}
                                                    onClick={() => activeLayerId && toggleFilter(activeLayerId, idx)}
                                                    title={filter.enabled ? "Disable" : "Enable"}
                                                >
                                                    {filter.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                                                </button>
                                                <button
                                                    className="filter-action-btn danger"
                                                    onClick={() => activeLayerId && removeFilter(activeLayerId, idx)}
                                                    title="Remove"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="dialogue-footer">
                    <button className="pref-btn pref-btn-secondary" onClick={onClose}>Close</button>
                    <button className="pref-btn pref-btn-primary" onClick={handleApply}>
                        <Check size={14} style={{ marginRight: 4 }} />
                        Add Filter
                    </button>
                </div>
            </div>
        </div>
    )
}
