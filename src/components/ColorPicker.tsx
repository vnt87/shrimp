import React, { useState, useRef, useCallback, useEffect } from 'react'

interface ColorPickerProps {
    color: string
    onChange: (color: string) => void
    onClose: () => void
    style?: React.CSSProperties
}

// Convert hex to HSV
function hexToHsv(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const v = max
    const d = max - min
    const s = max === 0 ? 0 : d / max
    let h = 0

    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break
            case g: h = (b - r) / d + 2; break
            case b: h = (r - g) / d + 4; break
        }
        h /= 6
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)]
}

// Convert HSV to hex
function hsvToHex(h: number, s: number, v: number): string {
    s /= 100
    v /= 100
    const i = Math.floor(h / 60)
    const f = h / 60 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    let r = 0, g = 0, b = 0

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break
        case 1: r = q; g = v; b = p; break
        case 2: r = p; g = v; b = t; break
        case 3: r = p; g = q; b = v; break
        case 4: r = t; g = p; b = v; break
        case 5: r = v; g = p; b = q; break
    }

    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export default function ColorPicker({ color, onChange, onClose, style }: ColorPickerProps) {
    const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color))
    const [hexInput, setHexInput] = useState(color)
    const satValueRef = useRef<HTMLDivElement>(null)
    const hueRef = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState<'sv' | 'hue' | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [recentColors] = useState<string[]>([
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
        '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
    ])

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    const updateColor = useCallback((h: number, s: number, v: number) => {
        setHsv([h, s, v])
        const hex = hsvToHex(h, s, v)
        setHexInput(hex)
        onChange(hex)
    }, [onChange])

    const handleSatValueMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!satValueRef.current) return
        const rect = satValueRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        const s = Math.round(x * 100)
        const v = Math.round((1 - y) * 100)
        updateColor(hsv[0], s, v)
    }, [hsv, updateColor])

    const handleHueMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!hueRef.current) return
        const rect = hueRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const h = Math.round(x * 360)
        updateColor(h, hsv[1], hsv[2])
    }, [hsv, updateColor])

    useEffect(() => {
        if (!dragging) return
        const handleMove = (e: MouseEvent) => {
            if (dragging === 'sv') handleSatValueMouse(e)
            else if (dragging === 'hue') handleHueMouse(e)
        }
        const handleUp = () => setDragging(null)
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
        return () => {
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
        }
    }, [dragging, handleSatValueMouse, handleHueMouse])

    const handleHexChange = (val: string) => {
        setHexInput(val)
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            const [h, s, v] = hexToHsv(val)
            setHsv([h, s, v])
            onChange(val)
        }
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                zIndex: 1000,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 12,
                width: 220,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                ...style
            }}
        >
            {/* Saturation/Value Area */}
            <div
                ref={satValueRef}
                onMouseDown={e => { setDragging('sv'); handleSatValueMouse(e) }}
                style={{
                    width: '100%',
                    height: 140,
                    borderRadius: 4,
                    position: 'relative',
                    cursor: 'crosshair',
                    background: `
                        linear-gradient(to top, #000, transparent),
                        linear-gradient(to right, #fff, hsl(${hsv[0]}, 100%, 50%))
                    `,
                    marginBottom: 8
                }}
            >
                <div style={{
                    position: 'absolute',
                    left: `${hsv[1]}%`,
                    top: `${100 - hsv[2]}%`,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 0 2px rgba(0,0,0,0.8)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none'
                }} />
            </div>

            {/* Hue Slider */}
            <div
                ref={hueRef}
                onMouseDown={e => { setDragging('hue'); handleHueMouse(e) }}
                style={{
                    width: '100%',
                    height: 14,
                    borderRadius: 7,
                    cursor: 'pointer',
                    position: 'relative',
                    background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                    marginBottom: 10
                }}
            >
                <div style={{
                    position: 'absolute',
                    left: `${(hsv[0] / 360) * 100}%`,
                    top: '50%',
                    width: 10,
                    height: 16,
                    borderRadius: 3,
                    border: '2px solid white',
                    boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    background: `hsl(${hsv[0]}, 100%, 50%)`
                }} />
            </div>

            {/* Hex Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 4,
                    border: '1px solid var(--border-color)',
                    background: hexInput
                }} />
                <input
                    type="text"
                    value={hexInput}
                    onChange={e => handleHexChange(e.target.value)}
                    maxLength={7}
                    style={{
                        flex: 1, padding: '4px 6px', borderRadius: 4,
                        border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace'
                    }}
                />
            </div>

            {/* Recent Colors */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {recentColors.map((c, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            const [h, s, v] = hexToHsv(c)
                            updateColor(h, s, v)
                        }}
                        style={{
                            width: 18, height: 18, borderRadius: 3,
                            background: c, cursor: 'pointer',
                            border: c === hexInput ? '2px solid var(--accent-color)' : '1px solid var(--border-color)'
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
