/**
 * pixelTools.ts
 * Core pixel-level manipulation algorithms for webgimp.
 */

export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Converts RGB to HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

/**
 * Converts HSL to RGB.
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (6 * (2 / 3 - t));
            return p;
        };
        r = hue2rgb(h + 1 / 3);
        g = hue2rgb(h);
        b = hue2rgb(h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Dodge/Burn implementation.
 * Targets specific luminance ranges.
 */
export function applyDodgeBurn(
    imageData: ImageData,
    mode: 'dodge' | 'burn',
    range: 'shadows' | 'midtones' | 'highlights',
    exposure: number
): void {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

        let shouldApply = false;
        if (range === 'shadows' && l < 0.33) shouldApply = true;
        else if (range === 'midtones' && l >= 0.33 && l <= 0.66) shouldApply = true;
        else if (range === 'highlights' && l > 0.66) shouldApply = true;

        if (shouldApply) {
            let newL = mode === 'dodge' ? l + (1 - l) * (exposure / 100) * 0.5 : l * (1 - (exposure / 100) * 0.5);
            newL = Math.max(0, Math.min(1, newL));
            const [r, g, b] = hslToRgb(h, s, newL);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
    }
}

/**
 * Smudge implementation.
 * Blends a sampled patch into the current brush position.
 */
export function smudgePatch(
    currentData: ImageData,
    prevData: ImageData,
    strength: number
): ImageData {
    const result = new ImageData(currentData.width, currentData.height);
    const alpha = strength / 100;

    for (let i = 0; i < currentData.data.length; i += 4) {
        result.data[i] = currentData.data[i] * (1 - alpha) + prevData.data[i] * alpha;
        result.data[i + 1] = currentData.data[i + 1] * (1 - alpha) + prevData.data[i + 1] * alpha;
        result.data[i + 2] = currentData.data[i + 2] * (1 - alpha) + prevData.data[i + 2] * alpha;
        result.data[i + 3] = currentData.data[i + 3]; // Keep current alpha or blend? Brush usually has its own mask.
    }
    return result;
}

/**
 * Blur/Sharpen implementation using convolution.
 */
export function applyBlurSharpen(
    imageData: ImageData,
    mode: 'blur' | 'sharpen',
    strength: number
): ImageData {
    if (mode === 'blur') {
        // Simple 3x3 box blur for real-time performance, strength scales radius or iterations
        // For a brush tool, we usually want a fast convolution
        return boxBlur(imageData, Math.max(1, Math.floor(strength / 20)));
    } else {
        // Unsharp mask or simple Laplacian sharpen
        return sharpen(imageData, strength / 100);
    }
}

function boxBlur(imageData: ImageData, radius: number): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dest = new Uint8ClampedArray(src.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                if (nx >= 0 && nx < width) {
                    const idx = (y * width + nx) * 4;
                    r += src[idx]; g += src[idx + 1]; b += src[idx + 2]; a += src[idx + 3];
                    count++;
                }
            }
            const idx = (y * width + x) * 4;
            dest[idx] = r / count; dest[idx + 1] = g / count; dest[idx + 2] = b / count; dest[idx + 3] = a / count;
        }
    }

    // Vertical pass (in-place on dest for simplicity, but src for pure)
    const final = new ImageData(width, height);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                const ny = y + dy;
                if (ny >= 0 && ny < height) {
                    const idx = (ny * width + x) * 4;
                    r += dest[idx]; g += dest[idx + 1]; b += dest[idx + 2]; a += dest[idx + 3];
                    count++;
                }
            }
            const idx = (y * width + x) * 4;
            final.data[idx] = r / count; final.data[idx + 1] = g / count; final.data[idx + 2] = b / count; final.data[idx + 3] = a / count;
        }
    }
    return final;
}

function sharpen(imageData: ImageData, amount: number): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const final = new ImageData(new Uint8ClampedArray(src), width, height);

    // 3x3 Sharpen Kernel:
    //  0 -1  0
    // -1  5 -1
    //  0 -1  0
    // We blend it based on amount

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                const center = src[i + c];
                const up = src[((y - 1) * width + x) * 4 + c];
                const down = src[((y + 1) * width + x) * 4 + c];
                const left = src[(y * width + (x - 1)) * 4 + c];
                const right = src[(y * width + (x + 1)) * 4 + c];

                const sharpened = 5 * center - up - down - left - right;
                final.data[i + c] = center * (1 - amount) + sharpened * amount;
            }
        }
    }
    return final;
}
