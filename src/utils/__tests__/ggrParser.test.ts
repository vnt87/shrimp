import { describe, it, expect } from 'vitest';
import { GGRParser } from '../ggrParser';

describe('GGRParser', () => {
    it('should parse a simple GIMP gradient file', () => {
        const simpleGGR = `GIMP Gradient
Name: Simple Gradient
2
0.000000 0.500000 0.500000 1.000000 0.000000 0.000000 1.000000 0.000000 1.000000 0.000000 1.000000 0 0
0.500000 0.500000 1.000000 0.000000 1.000000 0.000000 1.000000 0.000000 0.000000 1.000000 1.000000 0 0
`;
        const result = GGRParser.parse(simpleGGR, 'test-id');

        expect(result.id).toBe('test-id');
        expect(result.name).toBe('Simple Gradient');
        expect(result.segments.length).toBe(2);

        // Segment 1
        expect(result.segments[0].leftPos).toBe(0);
        expect(result.segments[0].rightPos).toBe(0.5);
        expect(result.segments[0].leftColor).toEqual({ r: 1, g: 0, b: 0, a: 1 }); // Red
        expect(result.segments[0].rightColor).toEqual({ r: 0, g: 1, b: 0, a: 1 }); // Green

        // Segment 2
        expect(result.segments[1].leftPos).toBe(0.5);
        expect(result.segments[1].rightPos).toBe(1);
        expect(result.segments[1].leftColor).toEqual({ r: 0, g: 1, b: 0, a: 1 }); // Green
        expect(result.segments[1].rightColor).toEqual({ r: 0, g: 0, b: 1, a: 1 }); // Blue
    });

    it('should throw error on invalid header', () => {
        const invalidGGR = `Not a GIMP Gradient
Name: Bad
1
...
`;
        expect(() => GGRParser.parse(invalidGGR, 'bad')).toThrow('Invalid GGR file: Header mismatch');
    });

    it('should handle complex GGR lines with extra tokens', () => {
        // Sometimes GIMP adds more floats at the end
        const complexLine = `0.0 0.5 1.0 1 1 1 1 0 0 0 1 0 0 0.5 0.5`;
        const content = `GIMP Gradient
Name: Complex
1
${complexLine}
`;
        const result = GGRParser.parse(content, 'complex');
        expect(result.segments.length).toBe(1);
        expect(result.segments[0].leftColor.r).toBe(1);
    });
});
