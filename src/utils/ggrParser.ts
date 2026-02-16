import { GradientResource, GradientSegment, BlendMode, ColorMode } from '../types/gradient';

export class GGRParser {

    private static BLEND_MODES: BlendMode[] = [
        'Linear',
        'Curved',
        'Sinusoidal',
        'SphericalIncreasing',
        'SphericalDecreasing',
        'Step'
    ];

    private static COLOR_MODES: ColorMode[] = [
        'RGB',
        'HSV_CCW',
        'HSV_CW'
    ];

    public static parse(content: string, id: string): GradientResource {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

        // 1. Validate Header
        if (lines[0] !== 'GIMP Gradient') {
            throw new Error('Invalid GGR file: Header mismatch');
        }

        // 2. Parse Name
        // GIMP usually puts "Name: " prefix, but sometimes just the name if it's older format. 
        // Standard format: "Name: Gradient Name"
        let name = 'Untitled Gradient';
        let lineIdx = 1;

        if (lines[lineIdx].startsWith('Name:')) {
            name = lines[lineIdx].substring(5).trim();
            lineIdx++;
        }

        // 3. Parse Segment Count
        const segmentCount = parseInt(lines[lineIdx], 10);
        if (isNaN(segmentCount)) {
            throw new Error('Invalid GGR file: Missing segment count');
        }
        lineIdx++;

        const segments: GradientSegment[] = [];

        for (let i = 0; i < segmentCount; i++) {
            if (lineIdx >= lines.length) break;

            const tokens = lines[lineIdx].split(/\s+/).map(parseFloat);

            // Expected at least 13 floats:
            // Left, Mid, Right, R0, G0, B0, A0, R1, G1, B1, A1, Type, Color
            // Sometimes 15 if there are extra params 

            if (tokens.length < 13) {
                console.warn(`Skipping invalid segment at line ${lineIdx}: not enough tokens`);
                lineIdx++;
                continue;
            }

            segments.push({
                leftPos: tokens[0],
                midPos: tokens[1],
                rightPos: tokens[2],
                leftColor: { r: tokens[3], g: tokens[4], b: tokens[5], a: tokens[6] },
                rightColor: { r: tokens[7], g: tokens[8], b: tokens[9], a: tokens[10] },
                blendMode: this.BLEND_MODES[tokens[11]] || 'Linear',
                colorMode: this.COLOR_MODES[tokens[12]] || 'RGB'
            });

            lineIdx++;
        }

        return {
            id,
            name,
            segments
        };
    }
}
