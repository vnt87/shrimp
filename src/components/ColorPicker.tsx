import React, { useState, useRef, useCallback, useEffect } from 'react'

interface ColorPickerProps {
    color: string
    onChange: (color: string) => void
    style?: React.CSSProperties
}

// ─── Color Conversion Utilities ───────────────────────────────────────────────

/** Convert a 6-digit hex string to HSV tuple [h(0-360), s(0-100), v(0-100)] */
function hexToHsv(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
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

/** Convert HSV [h(0-360), s(0-100), v(0-100)] to 6-digit hex string */
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

/** Parse hex → {r, g, b} each 0-255 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    }
}

/** Convert {r, g, b} each 0-255 → hex */
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PhotoshopColorPicker
 *
 * A custom color picker modelled after the Adobe Photoshop color picker UI:
 * - Large saturation/value (SV) square on the left
 * - Thin vertical hue strip beside the SV square
 * - "new / current" stacked color preview on the right of the hue strip
 * - Numeric fields for H (°), S (%), V (%) and R, G, B (0-255) + hex #
 *
 * All state is internal; `onChange` is called on every interaction.
 */
export default function ColorPicker({ color, onChange, style }: ColorPickerProps) {
    // ── State ──────────────────────────────────────────────────────────────────
    /** Current HSV values [hue 0-360, sat 0-100, val 0-100] */
    const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color))
    /** Controlled hex input string (may be partial while user is typing) */
    const [hexInput, setHexInput] = useState(color.replace('#', '').toUpperCase())
    /** The "current" (original) color shown in the preview — never changes after mount */
    const originalColor = useRef(color)

    // Drag state: which area is being dragged
    const [dragging, setDragging] = useState<'sv' | 'hue' | null>(null)

    // DOM refs for hit-testing
    const svRef = useRef<HTMLDivElement>(null)
    const hueRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // ── Derived values ─────────────────────────────────────────────────────────
    const [h, s, v] = hsv
    const currentHex = hsvToHex(h, s, v)
    const { r, g, b } = hexToRgb(currentHex)

    // ── Core update helper ─────────────────────────────────────────────────────
    /** Update all state from a new HSV triple and fire onChange */
    const applyHsv = useCallback((newH: number, newS: number, newV: number) => {
        const clamped: [number, number, number] = [
            Math.round(Math.max(0, Math.min(360, newH))),
            Math.round(Math.max(0, Math.min(100, newS))),
            Math.round(Math.max(0, Math.min(100, newV))),
        ]
        setHsv(clamped)
        const hex = hsvToHex(...clamped)
        setHexInput(hex.slice(1).toUpperCase())
        onChange(hex)
    }, [onChange])

    // ── SV area drag logic ─────────────────────────────────────────────────────
    const handleSvPointer = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!svRef.current) return
        const rect = svRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        applyHsv(h, x * 100, (1 - y) * 100)
    }, [h, applyHsv])

    // ── Hue strip drag logic ───────────────────────────────────────────────────
    const handleHuePointer = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!hueRef.current) return
        const rect = hueRef.current.getBoundingClientRect()
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        applyHsv(y * 360, s, v)
    }, [s, v, applyHsv])

    // ── Global mouse move / up while dragging ──────────────────────────────────
    useEffect(() => {
        if (!dragging) return
        const handleMove = (e: MouseEvent) => {
            if (dragging === 'sv') handleSvPointer(e)
            else if (dragging === 'hue') handleHuePointer(e)
        }
        const handleUp = () => setDragging(null)
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
        return () => {
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
        }
    }, [dragging, handleSvPointer, handleHuePointer])

    // ── Hex input handler ──────────────────────────────────────────────────────
    const handleHexInput = (raw: string) => {
        const val = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6)
        setHexInput(val)
        if (val.length === 6) {
            const [nh, ns, nv] = hexToHsv(`#${val}`)
            setHsv([nh, ns, nv])
            onChange(`#${val}`)
        }
    }

    // ── RGB input handler ──────────────────────────────────────────────────────
    const handleRgbChange = (channel: 'r' | 'g' | 'b', raw: string) => {
        const val = Math.max(0, Math.min(255, parseInt(raw) || 0))
        const newR = channel === 'r' ? val : r
        const newG = channel === 'g' ? val : g
        const newB = channel === 'b' ? val : b
        const hex = rgbToHex(newR, newG, newB)
        const [nh, ns, nv] = hexToHsv(hex)
        setHsv([nh, ns, nv])
        setHexInput(hex.slice(1).toUpperCase())
        onChange(hex)
    }

    // ── HSV input handler ──────────────────────────────────────────────────────
    const handleHsvChange = (channel: 'h' | 's' | 'v', raw: string) => {
        const parsed = parseInt(raw) || 0
        if (channel === 'h') applyHsv(parsed, s, v)
        else if (channel === 's') applyHsv(h, parsed, v)
        else applyHsv(h, s, parsed)
    }

    // ── Shared number input style ──────────────────────────────────────────────
    const numInputStyle: React.CSSProperties = {
        width: 52,
        padding: '2px 4px',
        borderRadius: 3,
        border: '1px solid var(--border-color, #555)',
        background: 'var(--bg-input, #2a2a2a)',
        color: 'var(--text-primary, #eee)',
        fontSize: 12,
        textAlign: 'right',
    }

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        color: 'var(--text-secondary, #aaa)',
        minWidth: 16,
        textAlign: 'right',
    }

    const unitStyle: React.CSSProperties = {
        fontSize: 11,
        color: 'var(--text-secondary, #aaa)',
        minWidth: 14,
    }

    // ── Sizes ──────────────────────────────────────────────────────────────────
    const SV_SIZE = 240   // width & height of the SV square (px)
    const HUE_W = 20     // width of the hue strip (px)
    const HUE_H = SV_SIZE // hue strip is same height as SV square

    return (
        <div
            ref={containerRef}
            style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                ...style,
            }}
        >
            {/* ── Left column: SV square + hue strip ────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>

                {/* Saturation / Value square */}
                <div
                    ref={svRef}
                    onMouseDown={e => { setDragging('sv'); handleSvPointer(e) }}
                    style={{
                        width: SV_SIZE,
                        height: SV_SIZE,
                        borderRadius: 4,
                        position: 'relative',
                        cursor: 'crosshair',
                        flexShrink: 0,
                        /* Composite gradient: black→transparent (bottom), white→hue (right) */
                        background: `
                            linear-gradient(to top, #000 0%, transparent 100%),
                            linear-gradient(to right, #fff 0%, hsl(${h}, 100%, 50%) 100%)
                        `,
                        border: '1px solid rgba(0,0,0,0.4)',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Crosshair cursor */}
                    <div style={{
                        position: 'absolute',
                        left: `${s}%`,
                        top: `${100 - v}%`,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '2px solid white',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                    }} />
                </div>

                {/* Vertical hue strip */}
                <div
                    ref={hueRef}
                    onMouseDown={e => { setDragging('hue'); handleHuePointer(e) }}
                    style={{
                        width: HUE_W,
                        height: HUE_H,
                        borderRadius: 4,
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                        background: 'linear-gradient(to bottom, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)',
                        border: '1px solid rgba(0,0,0,0.4)',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Hue thumb — two small horizontal bars like Photoshop */}
                    <div style={{
                        position: 'absolute',
                        top: `${(h / 360) * 100}%`,
                        left: -4,
                        right: -4,
                        height: 4,
                        borderRadius: 2,
                        background: 'white',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                    }} />
                </div>
            </div>

            {/* ── Right column: new/current preview + numeric inputs ─────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>

                {/* new / current color preview */}
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary, #aaa)', marginBottom: 2, textAlign: 'center' }}>new</span>
                    <div style={{
                        width: '100%',
                        height: 36,
                        borderRadius: '4px 4px 0 0',
                        background: currentHex,
                        border: '1px solid rgba(0,0,0,0.4)',
                        borderBottom: 'none',
                    }} />
                    <div style={{
                        width: '100%',
                        height: 36,
                        borderRadius: '0 0 4px 4px',
                        background: originalColor.current,
                        border: '1px solid rgba(0,0,0,0.4)',
                        cursor: 'pointer',
                    }}
                        title="Click to revert to original color"
                        onClick={() => {
                            // Revert to the original color
                            const [oh, os, ov] = hexToHsv(originalColor.current)
                            applyHsv(oh, os, ov)
                        }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary, #aaa)', marginTop: 2, textAlign: 'center' }}>current</span>
                </div>

                {/* ── HSV inputs ─────────────────────────────────────────────────── */}
                {([
                    { ch: 'h', label: 'H', val: h, unit: '°', min: 0, max: 360 },
                    { ch: 's', label: 'S', val: s, unit: '%', min: 0, max: 100 },
                    { ch: 'v', label: 'V', val: v, unit: '%', min: 0, max: 100 },
                ] as const).map(({ ch, label, val, unit }) => (
                    <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={labelStyle}>{label}</span>
                        <input
                            type="number"
                            style={numInputStyle}
                            value={val}
                            min={0}
                            max={ch === 'h' ? 360 : 100}
                            onChange={e => handleHsvChange(ch, e.target.value)}
                        />
                        <span style={unitStyle}>{unit}</span>
                    </div>
                ))}

                {/* ── RGB inputs ─────────────────────────────────────────────────── */}
                {([
                    { ch: 'r', label: 'R', val: r },
                    { ch: 'g', label: 'G', val: g },
                    { ch: 'b', label: 'B', val: b },
                ] as const).map(({ ch, label, val }) => (
                    <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={labelStyle}>{label}</span>
                        <input
                            type="number"
                            style={numInputStyle}
                            value={val}
                            min={0}
                            max={255}
                            onChange={e => handleRgbChange(ch, e.target.value)}
                        />
                    </div>
                ))}

                {/* ── Hex input ──────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={labelStyle}>#</span>
                    <input
                        type="text"
                        value={hexInput}
                        maxLength={6}
                        onChange={e => handleHexInput(e.target.value)}
                        style={{
                            ...numInputStyle,
                            width: 66,
                            textAlign: 'left',
                            fontFamily: 'monospace',
                            letterSpacing: '0.05em',
                        }}
                        placeholder="RRGGBB"
                    />
                </div>
            </div>
        </div>
    )
}
