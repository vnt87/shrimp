
export type BrushSourceFormat = 'shrimp-internal' | 'gbr' | 'gih' | 'myb' | 'kpp';

export interface BrushInput {
    x: number;
    y: number;
    pressure: number; // 0.0 to 1.0, default 0.5
    tiltX?: number;   // -90 to 90
    tiltY?: number;   // -90 to 90
    time: number;     // Timestamp in ms
}

export interface BrushSettings {
    // Core MyPaint parameters
    radius: number;          // Base brush radius (logarithmic usually)
    opacity: number;         // 0.0 to 1.0
    hardness: number;        // 0.0 to 1.0
    color: { r: number; g: number; b: number }; // RGB 0-1 or 0-255

    // Dynamics (Simplified for UI/Configuration)
    speedSensitivity?: number;
    pressureSensitivity?: number;

    // Custom tip (if not using standard MyPaint procedural)
    brushTipImage?: HTMLImageElement | HTMLCanvasElement;
}

export interface BrushPreset {
    id: string;
    name: string;
    sourceFormat: BrushSourceFormat;

    // Icon/Preview for the UI
    thumbnailUrl?: string;

    // The "meat" of the brush
    settings: BrushSettings;

    // Raw data for reconstruction (if we need to re-parse or export)
    rawData?: ArrayBuffer;

    // Specific metadata for different formats
    metadata?: {
        gimpParams?: GimpBrushMetadata;
        kritaParams?: KritaBrushMetadata;
        myPaintJson?: string; // Original JSON if .myb
    };
}

export interface GimpBrushMetadata {
    spacing: number;
    description: string;
    // .gih specific
    webParams?: {
        ranks: number[];
        dimension: number;
    };
}

export interface KritaBrushMetadata {
    paintOpId: string; // e.g., "pixel_brush", "color_smudge"
    eraser: boolean;
}
