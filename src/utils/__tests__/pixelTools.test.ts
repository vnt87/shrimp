import { describe, it, expect, beforeAll } from 'vitest';
import { rgbToHsl, hslToRgb, applyDodgeBurn, smudgePatch, applyBlurSharpen } from '../pixelTools';

beforeAll(() => {
    // Polyfill ImageData for Vitest (Node environment)
    if (typeof global.ImageData === 'undefined') {
        (global as any).ImageData = class ImageData {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            constructor(arg1: any, arg2: number, arg3?: number) {
                if (arg1 instanceof Uint8ClampedArray) {
                    this.data = arg1;
                    this.width = arg2;
                    this.height = arg3!;
                } else {
                    this.width = arg1;
                    this.height = arg2;
                    this.data = new Uint8ClampedArray(this.width * this.height * 4);
                }
            }
        };
    }
});

describe('pixelTools', () => {
    describe('Color conversions', () => {
        it('should convert RGB to HSL and back', () => {
            const r = 255, g = 0, b = 0; // Red
            const [h, s, l] = rgbToHsl(r, g, b);
            expect(h).toBeCloseTo(0);
            expect(s).toBeCloseTo(1);
            expect(l).toBeCloseTo(0.5);

            const [r2] = hslToRgb(h, s, l);
            expect(r2).toBe(255);
        });

        it('should handle white color', () => {
            const [r, g, b] = [255, 255, 255];
            const [h, s, l] = rgbToHsl(r, g, b);
            expect(l).toBe(1);
            const [r2, g2, b2] = hslToRgb(h, s, l);
            expect(r2).toBe(255);
        });
    });

    describe('applyDodgeBurn', () => {
        it('should lighten midtones in dodge mode', () => {
            const data = new Uint8ClampedArray([128, 128, 128, 255]);
            const imageData = { data, width: 1, height: 1 } as ImageData;
            applyDodgeBurn(imageData, 'dodge', 'midtones', 50);
            expect(data[0]).toBeGreaterThan(128);
        });

        it('should darken midtones in burn mode', () => {
            const data = new Uint8ClampedArray([128, 128, 128, 255]);
            const imageData = { data, width: 1, height: 1 } as ImageData;
            applyDodgeBurn(imageData, 'burn', 'midtones', 50);
            expect(data[0]).toBeLessThan(128);
        });
    });

    describe('smudgePatch', () => {
        it('should blend current data with previous data (clamped)', () => {
            const current = new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);
            const prev = new ImageData(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1);
            const result = smudgePatch(current, prev, 50);

            expect(result.data[0]).toBe(128); // 127.5 clamped to 128
            expect(result.data[2]).toBe(128); // 127.5 clamped to 128
        });
    });

    describe('applyBlurSharpen', () => {
        it('should blur an image (box blur check)', () => {
            // 3x3 image with a single pixel in center
            // 0 0 0
            // 0 1 0
            // 0 0 0
            const data = new Uint8ClampedArray(9 * 4).fill(0);
            data[4 * 4] = 255;
            data[4 * 4 + 1] = 255;
            data[4 * 4 + 2] = 255;
            data[4 * 4 + 3] = 255;

            const imageData = { data, width: 3, height: 3 } as ImageData;
            const result = applyBlurSharpen(imageData, 'blur', 50);

            // Center pixel should be diffused
            expect(result.data[4 * 4]).toBeLessThan(255);
            // Neighbor pixels should be non-zero
            expect(result.data[3 * 4]).toBeGreaterThan(0);
        });
    });
});
