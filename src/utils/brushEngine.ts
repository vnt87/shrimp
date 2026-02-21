
import { BrushSettings, BrushInput, BrushSourceFormat, BrushPreset } from '../types/brush';
import { parseGbr } from './brushParsers/gbrParser';
import { parseMyPaint } from './brushParsers/mypaintParser';

export class BrushEngine {
    private isInitialized = false;
    // private wasmModule: any = null;
    // private surface: any = null;
    // private brush: any = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    // Internal state
    private currentSettings: BrushSettings = {
        radius: 10,
        opacity: 1.0,
        hardness: 0.8,
        color: { r: 0, g: 0, b: 0 }
    };
    private lastInput: BrushInput | null = null;

    constructor() { }

    /**
     * Initialize the WASM module.
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // In a real implementation, we would load the WASM file here.
            // For now, we'll setup a placeholder or try to load if available.
            // const response = await fetch('/wasm/brushlib.wasm');
            // const bytes = await response.arrayBuffer();
            // this.wasmModule = await WebAssembly.instantiate(bytes, { ... });

            this.isInitialized = true;
        } catch (e) {
            console.error('BrushEngine: Failed to init WASM', e);
            throw e;
        }
    }

    /**
     * Set the target canvas for drawing.
     */
    setSurface(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * Configure the current brush.
     */
    configureBrush(settings: Partial<BrushSettings>): void {
        this.currentSettings = { ...this.currentSettings, ...settings };
    }

    /**
     * Load a brush from a file/blob.
     */
    async loadBrush(data: ArrayBuffer | string, format: BrushSourceFormat, name: string): Promise<BrushPreset> {
        const id = crypto.randomUUID();
        const settings: BrushSettings = { ...this.currentSettings }; // Copy current defaults
        let metadata: any = undefined;

        try {
            switch (format) {
                case 'gbr':
                    if (typeof data !== 'string') {
                        const parsed = parseGbr(data as ArrayBuffer);
                        console.log('Parsed GBR:', parsed);
                        settings.radius = parsed.header.width / 2;
                        // In a real engine, we would upload parsed.bitmap to the WASM surface
                    }
                    break;
                case 'myb':
                    if (typeof data === 'string') {
                        const parsed = parseMyPaint(data);
                        console.log('Parsed MyPaint:', parsed);
                        // Map generic settings
                        if (parsed.settings) {
                            // MyPaint uses logarithmic radius. radius = exp(radius_log).
                            // Default base radius in MyPaint is often 2.0 (exp(2) ~ 7.39)
                            const rLog = parsed.settings['radius_logarithmic'] ?? 2;
                            settings.radius = Math.exp(rLog);

                            settings.opacity = parsed.settings['opaque'] ?? 1;
                            settings.hardness = parsed.settings['hardness'] ?? 0.8;
                        }
                        metadata = { myPaintJson: data, definition: parsed };
                    }
                    break;
                default:
                    console.warn('Unsupported format for loadBrush:', format);
            }
        } catch (err) {
            console.error('Failed to parse brush:', err);
            // Return a broken/default preset or throw?
            // For now, return what we have with original name
        }

        const preset: BrushPreset = {
            id,
            name,
            sourceFormat: format,
            settings,
            rawData: typeof data !== 'string' ? data as ArrayBuffer : undefined,
            metadata
        };

        return preset;
    }

    /**
     * Start a stroke.
     */
    startStroke(input: BrushInput): void {
        if (!this.ctx) return;
        this.ctx.beginPath();
        this.ctx.moveTo(input.x, input.y);
        this.lastInput = input;
    }

    /**
     * Continue a stroke.
     */
    continueStroke(input: BrushInput): void {
        if (!this.ctx || !this.lastInput) return;

        // Fallback drawing logic (simulation of brush engine)
        // In real WASM engine, we would call: this.wasmModule.stroke_to(surface, input.x, input.y, pressure, tilt, dtime);

        const pressure = input.pressure;
        this.ctx.lineWidth = this.currentSettings.radius * 2 * pressure;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = `rgba(${this.currentSettings.color.r}, ${this.currentSettings.color.g}, ${this.currentSettings.color.b}, ${this.currentSettings.opacity})`;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastInput.x, this.lastInput.y);
        this.ctx.lineTo(input.x, input.y);
        this.ctx.stroke();

        this.lastInput = input;
    }

    /**
     * End the stroke.
     */
    endStroke(): void {
        this.lastInput = null;
    }
    
    /**
     * Get the last input position for continuity when canvas is replaced.
     */
    getLastInput(): BrushInput | null {
        return this.lastInput;
    }
}
