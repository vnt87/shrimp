import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { EditorContent, Layer } from '../components/EditorContext';
import { canvasToBlob, blobToCanvas } from './imageUtils';

interface SerializedLayer extends Omit<Layer, 'data' | 'children'> {
    assetPath?: string;
    children?: SerializedLayer[];
}

interface Manifest {
    version: number;
    canvasSize: { width: number; height: number };
    layers: SerializedLayer[];
    activeLayerId: string | null;
    activePathId: string | null;
    guides: any[]; // define stricter types if needed
    selection: any | null;
    paths: any[];
}

// --- Saving ---

const processLayerForSave = async (
    layer: Layer,
    zip: JSZip,
    assetsFolder: JSZip | null
): Promise<SerializedLayer> => {
    let assetPath: string | undefined;

    if (layer.data && assetsFolder) {
        const blob = await canvasToBlob(layer.data);
        if (blob) {
            const fileName = `layer-${layer.id}.png`;
            assetsFolder.file(fileName, blob);
            assetPath = `assets/${fileName}`;
        }
    }

    const processedChildren = layer.children
        ? await Promise.all(layer.children.map(child => processLayerForSave(child, zip, assetsFolder)))
        : undefined;

    // Create a copy of the layer without the heavy data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, children, ...rest } = layer;

    return {
        ...rest,
        assetPath,
        children: processedChildren,
    };
};

export const saveToShrimpFile = async (content: EditorContent, filename: string = 'design.shrimp') => {
    const zip = new JSZip();
    const assetsFolder = zip.folder('assets');

    // Process layers recursively
    const serializedLayers = await Promise.all(
        content.layers.map(layer => processLayerForSave(layer, zip, assetsFolder))
    );

    const manifest: Manifest = {
        version: 1,
        canvasSize: content.canvasSize,
        layers: serializedLayers,
        activeLayerId: content.activeLayerId,
        activePathId: content.activePathId,
        guides: content.guides,
        selection: content.selection,
        paths: content.paths,
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Generate thumbnail (optional - use flattened image or first layer)
    // For now, let's skip complex flattening logic here or maybe just use the first visible layer as thumbnail?
    // A better approach for thumbnail would be to composite the image, but that might be heavy directly in save.
    // Let's keep it simple for v1.

    const contentBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(contentBlob, filename);
};

// --- Loading ---

const processLayerForLoad = async (
    serializedLayer: SerializedLayer,
    zip: JSZip
): Promise<Layer> => {
    let data: HTMLCanvasElement | null = null;

    if (serializedLayer.assetPath) {
        const file = zip.file(serializedLayer.assetPath);
        if (file) {
            const blob = await file.async('blob');
            data = await blobToCanvas(blob);
        }
    }

    const children = serializedLayer.children
        ? await Promise.all(serializedLayer.children.map(child => processLayerForLoad(child, zip)))
        : undefined;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { assetPath, ...rest } = serializedLayer;

    return {
        ...rest,
        data,
        children,
    } as Layer;
};

export const loadFromShrimpFile = async (file: File): Promise<EditorContent> => {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file('manifest.json');

    if (!manifestFile) {
        throw new Error('Invalid .shrimp file: manifest.json missing');
    }

    const manifestText = await manifestFile.async('string');
    const manifest: Manifest = JSON.parse(manifestText);

    if (manifest.version !== 1) {
        console.warn(`Warning: loading file with version ${manifest.version}, current supported version is 1`);
    }

    const layers = await Promise.all(
        manifest.layers.map(layer => processLayerForLoad(layer, zip))
    );

    return {
        layers,
        activeLayerId: manifest.activeLayerId,
        canvasSize: manifest.canvasSize,
        guides: manifest.guides || [],
        selection: manifest.selection || null,
        paths: manifest.paths || [],
        activePathId: manifest.activePathId || null,
    };
};
