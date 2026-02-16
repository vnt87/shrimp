import React, { createContext, useContext, useState, useEffect } from 'react'

export interface BrushPreset {
    id: string
    name: string
    size: number
    opacity: number
    hardness: number
    spacing: number
}

export interface GradientPreset {
    id: string
    name: string
    colors: { offset: number; color: string }[]
    type: 'linear' | 'radial'
}

export interface TextStylePreset {
    id: string
    name: string
    fontFamily: string
    fontSize: number
    color: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
}

interface PresetsContextType {
    brushPresets: BrushPreset[]
    addBrushPreset: (preset: Omit<BrushPreset, 'id'>) => void
    removeBrushPreset: (id: string) => void

    gradientPresets: GradientPreset[]
    addGradientPreset: (preset: Omit<GradientPreset, 'id'>) => void
    removeGradientPreset: (id: string) => void

    textStylePresets: TextStylePreset[]
    addTextStylePreset: (preset: Omit<TextStylePreset, 'id'>) => void
    removeTextStylePreset: (id: string) => void
}

const PresetsContext = createContext<PresetsContextType | undefined>(undefined)

const DEFAULT_BRUSH_PRESETS: BrushPreset[] = [
    { id: '1', name: 'Hard Round', size: 10, opacity: 100, hardness: 100, spacing: 10 },
    { id: '2', name: 'Soft Round', size: 20, opacity: 50, hardness: 0, spacing: 5 },
]

const DEFAULT_GRADIENT_PRESETS: GradientPreset[] = [
    { id: '1', name: 'Black to White', colors: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }], type: 'linear' },
    { id: '2', name: 'Rainbow', colors: [{ offset: 0, color: '#ff0000' }, { offset: 0.5, color: '#00ff00' }, { offset: 1, color: '#0000ff' }], type: 'linear' },
]

const DEFAULT_TEXT_PRESETS: TextStylePreset[] = [
    { id: '1', name: 'Heading 1', fontFamily: 'Inter', fontSize: 32, color: '#000000', bold: true, italic: false, underline: false, strikethrough: false },
    { id: '2', name: 'Body Text', fontFamily: 'Inter', fontSize: 16, color: '#333333', bold: false, italic: false, underline: false, strikethrough: false },
]

export function PresetsProvider({ children }: { children: React.ReactNode }) {
    const [brushPresets, setBrushPresets] = useState<BrushPreset[]>(() => {
        const saved = localStorage.getItem('webgimp_brush_presets')
        return saved ? JSON.parse(saved) : DEFAULT_BRUSH_PRESETS
    })

    const [gradientPresets, setGradientPresets] = useState<GradientPreset[]>(() => {
        const saved = localStorage.getItem('webgimp_gradient_presets')
        return saved ? JSON.parse(saved) : DEFAULT_GRADIENT_PRESETS
    })

    const [textStylePresets, setTextStylePresets] = useState<TextStylePreset[]>(() => {
        const saved = localStorage.getItem('webgimp_text_presets')
        return saved ? JSON.parse(saved) : DEFAULT_TEXT_PRESETS
    })

    useEffect(() => {
        localStorage.setItem('webgimp_brush_presets', JSON.stringify(brushPresets))
    }, [brushPresets])

    useEffect(() => {
        localStorage.setItem('webgimp_gradient_presets', JSON.stringify(gradientPresets))
    }, [gradientPresets])

    useEffect(() => {
        localStorage.setItem('webgimp_text_presets', JSON.stringify(textStylePresets))
    }, [textStylePresets])

    const addBrushPreset = (preset: Omit<BrushPreset, 'id'>) => {
        const newPreset = { ...preset, id: Math.random().toString(36).substr(2, 9) }
        setBrushPresets(prev => [...prev, newPreset])
    }

    const removeBrushPreset = (id: string) => {
        setBrushPresets(prev => prev.filter(p => p.id !== id))
    }

    const addGradientPreset = (preset: Omit<GradientPreset, 'id'>) => {
        const newPreset = { ...preset, id: Math.random().toString(36).substr(2, 9) }
        setGradientPresets(prev => [...prev, newPreset])
    }

    const removeGradientPreset = (id: string) => {
        setGradientPresets(prev => prev.filter(p => p.id !== id))
    }

    const addTextStylePreset = (preset: Omit<TextStylePreset, 'id'>) => {
        const newPreset = { ...preset, id: Math.random().toString(36).substr(2, 9) }
        setTextStylePresets(prev => [...prev, newPreset])
    }

    const removeTextStylePreset = (id: string) => {
        setTextStylePresets(prev => prev.filter(p => p.id !== id))
    }

    return (
        <PresetsContext.Provider value={{
            brushPresets,
            addBrushPreset,
            removeBrushPreset,
            gradientPresets,
            addGradientPreset,
            removeGradientPreset,
            textStylePresets,
            addTextStylePreset,
            removeTextStylePreset
        }}>
            {children}
        </PresetsContext.Provider>
    )
}

export const usePresets = () => {
    const context = useContext(PresetsContext)
    if (!context) {
        throw new Error('usePresets must be used within a PresetsProvider')
    }
    return context
}
