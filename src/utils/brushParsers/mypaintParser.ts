
export interface MyPaintBrushDef {
    settings: Record<string, number>;
    name?: string;
    notes?: string;
    parent_brush_name?: string;
    version?: number;
}

export const parseMyPaint = (jsonString: string): MyPaintBrushDef => {
    try {
        const data = JSON.parse(jsonString);
        // Basic validation
        if (!data.settings) {
            console.warn('MyPaint Parser: No settings found in JSON');
        }
        return data as MyPaintBrushDef;
    } catch (e) {
        throw new Error('Failed to parse MyPaint brush JSON: ' + e);
    }
};
