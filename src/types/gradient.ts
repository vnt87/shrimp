export type BlendMode =
    | 'Linear'
    | 'Curved'
    | 'Sinusoidal'
    | 'SphericalIncreasing'
    | 'SphericalDecreasing'
    | 'Step';

export type ColorMode = 'RGB' | 'HSV_CCW' | 'HSV_CW';

export interface GradientSegment {
    leftPos: number;
    midPos: number;
    rightPos: number;

    leftColor: { r: number, g: number, b: number, a: number };
    rightColor: { r: number, g: number, b: number, a: number };

    blendMode: BlendMode;
    colorMode: ColorMode;
}

export interface GradientResource {
    id: string;
    name: string;
    segments: GradientSegment[];
    tags?: string[];
}
