import { GradientResource, GradientSegment, BlendMode, ColorMode } from '../types/gradient';

interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

// Helper: HSV to RGB
function hsvToRgb(h: number, s: number, v: number): { r: number, g: number, b: number } {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return { r, g, b };
}

// Helper: RGB to HSV
function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h, s, v };
}

function mix(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function calculateSegmentFactor(segment: GradientSegment, t: number): number {
    // Map global T (0..1) to segment local T (0..1)
    // Segment range: [leftPos, rightPos]
    // If t is within this range, we normalize it.

    // Safety check
    if (Math.abs(segment.rightPos - segment.leftPos) < 0.000001) return 0.5;

    const segmentLen = segment.rightPos - segment.leftPos;
    const localT = (t - segment.leftPos) / segmentLen;

    // Apply Midpoint skew
    // The midpoint (midPos) is where the color is 50% mixed.
    // In GIMP, midPos is relative 0..1 within the segment segmentLen? 
    // Wait, GGR documentation says midPos is absolute coordinate. 
    // We need to normalize midPos relative to the segment range.

    // Relative Midpoint (0..1)
    const mid = (segment.midPos - segment.leftPos) / segmentLen;

    // GIMP uses a specific power function to shift the midpoint
    // If mid=0.5, factor=1 (linear). 
    // If mid < 0.5, skew towards left.
    // basic formula: t' = t ^ (log(0.5) / log(mid))

    if (localT < 0) return 0;
    if (localT > 1) return 1;

    // Handle standard linear case optimization
    if (Math.abs(mid - 0.5) < 0.001) {
        return applyBlendMode(localT, segment.blendMode);
    }

    // Apply skew
    const skewExponent = Math.log(0.5) / Math.log(mid);
    const skewedT = Math.pow(localT, skewExponent);

    return applyBlendMode(skewedT, segment.blendMode);
}

function applyBlendMode(t: number, mode: BlendMode): number {
    switch (mode) {
        case 'Linear':
            return t;
        case 'Curved':
            // Simple ease-in-out could approximate, but GIMP uses specific curve
            // t^((1-t)/2 + t*2) ? 
            // Actually GIMP "Curved" is often Spline, but for simple approximation:
            // Use Sine-like ease
            return Math.pow(Math.sin((t * Math.PI) / 2), 1.5); // Approximation
        case 'Sinusoidal':
            // (1 - cos(pi * t)) / 2
            return (1 - Math.cos(Math.PI * t)) / 2;
        case 'SphericalIncreasing':
            // sqrt(1 - (t-1)^2) ? No, typically 1 - sqrt(1 - t^2) or similar
            // Standard spherical ease-out
            return Math.sqrt(1 - (t - 1) * (t - 1)); // Circular ease out?
            // GIMP source: return sqrt(x) for increasing? verify
            // Let's use generic approximation for now:
            // Rising quadrant of circle
            return Math.sqrt(2 * t - t * t); // This is ease-out-circ in standard libs
        case 'SphericalDecreasing':
            // t * t? 
            return 1 - Math.sqrt(1 - t * t);
        case 'Step':
            return t >= 0.5 ? 1 : 0;
        default:
            return t;
    }
}

function interpolateColor(c1: Color, c2: Color, t: number, mode: ColorMode): Color {
    // Alpha always linear
    const a = mix(c1.a, c2.a, t);

    // Color channels
    let r, g, b;

    if (mode === 'RGB') {
        r = mix(c1.r, c2.r, t);
        g = mix(c1.g, c2.g, t);
        b = mix(c1.b, c2.b, t);
    } else {
        // HSV Interpolation
        const hsv1 = rgbToHsv(c1.r, c1.g, c1.b);
        const hsv2 = rgbToHsv(c2.r, c2.g, c2.b);

        let s = mix(hsv1.s, hsv2.s, t);
        let v = mix(hsv1.v, hsv2.v, t);
        let h = 0;

        if (mode === 'HSV_CCW') {
            // Counter-clockwise
            let h1 = hsv1.h;
            let h2 = hsv2.h;
            if (h2 < h1) h2 += 1; // Wrap around
            h = mix(h1, h2, t) % 1;
        } else {
            // Clockwise
            let h1 = hsv1.h;
            let h2 = hsv2.h;
            if (h2 > h1) h1 += 1; // Wrap around
            h = mix(h1, h2, t) % 1;
        }

        const rgb = hsvToRgb(h, s, v);
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
    }

    return { r, g, b, a };
}

export function evaluateGradient(gradient: GradientResource, t: number): Color {
    // 1. Find the segment that contains t
    // Optimization: Segments are ordered. 
    // GIMP gradients cover 0..1 completely.

    t = Math.max(0, Math.min(1, t));

    const segment = gradient.segments.find(s => t >= s.leftPos && t <= s.rightPos);

    // Edge case handling if t is exactly 1 or not found due to float precision
    if (!segment) {
        // Return last segment's right color if t=1
        if (t >= 1 && gradient.segments.length > 0) {
            return gradient.segments[gradient.segments.length - 1].rightColor;
        }
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    // 2. Calculate local T within segment
    const localT = calculateSegmentFactor(segment, t);

    // 3. Interpolate color
    return interpolateColor(segment.leftColor, segment.rightColor, localT, segment.colorMode);
}

export function generateGradientTexture(gradient: GradientResource, width: number = 256): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (!ctx) return canvas;

    const imageData = ctx.createImageData(width, 1);
    const data = imageData.data;

    for (let x = 0; x < width; x++) {
        const t = x / (width - 1);
        const color = evaluateGradient(gradient, t);

        const idx = x * 4;
        data[idx] = Math.round(color.r * 255);
        data[idx + 1] = Math.round(color.g * 255);
        data[idx + 2] = Math.round(color.b * 255);
        data[idx + 3] = Math.round(color.a * 255);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

export function generateGradientLUT(gradient: GradientResource, size: number = 2048): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(size * 4);

    for (let i = 0; i < size; i++) {
        const t = i / (size - 1);
        const color = evaluateGradient(gradient, t);

        const idx = i * 4;
        lut[idx] = Math.round(color.r * 255);
        lut[idx + 1] = Math.round(color.g * 255);
        lut[idx + 2] = Math.round(color.b * 255);
        lut[idx + 3] = Math.round(color.a * 255);
    }

    return lut;
}
