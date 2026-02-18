
import { EditorContent, Layer } from '../components/EditorContext';
import { blobToCanvas } from './imageUtils';
import heic2any from 'heic2any';
import * as svgPathParser from 'svg-path-parser';

export type FileType = 'shrimp' | 'raster' | 'svg' | 'pdf' | 'psd' | 'tiff' | 'heic' | 'unknown';

export interface ImportResult {
    type: FileType;
    content?: EditorContent;
    layers?: Layer[];
    error?: string;
}

export class ImportManager {
    private static worker: Worker | null = null;

    private static getWorker() {
        if (!this.worker) {
            this.worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' });
        }
        return this.worker;
    }

    static async detectFileType(file: File): Promise<FileType> {
        const name = file.name.toLowerCase();
        if (name.endsWith('.shrimp')) return 'shrimp';
        if (name.endsWith('.svg')) return 'svg';
        if (name.endsWith('.pdf')) return 'pdf';
        if (name.endsWith('.psd')) return 'psd';
        if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'tiff';
        if (name.endsWith('.heic') || name.endsWith('.heif')) return 'heic';

        if (file.type.startsWith('image/')) return 'raster';

        return 'unknown';
    }

    static async importFile(file: File): Promise<ImportResult> {
        const type = await this.detectFileType(file);

        try {
            switch (type) {
                case 'raster':
                    const canvas = await blobToCanvas(file);
                    return {
                        type,
                        layers: [this.createLayer(file.name, canvas)]
                    };
                case 'heic':
                    const convertedBlob = await (heic2any as any)({
                        blob: file,
                        toType: 'image/png'
                    });
                    const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    const heicCanvas = await blobToCanvas(finalBlob);
                    return {
                        type,
                        layers: [this.createLayer(file.name, heicCanvas)]
                    };
                case 'svg':
                    const text = await file.text();

                    // 1. Rasterize SVG for the layer
                    const svgBlob = new Blob([text], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(svgBlob);

                    const svgCanvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width || 800;
                            canvas.height = img.height || 600;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0);
                            URL.revokeObjectURL(url);
                            resolve(canvas);
                        };
                        img.onerror = reject;
                        img.src = url;
                    });

                    // 2. Extract paths for the Paths panel
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
                    const pathElements = svgDoc.querySelectorAll('path');
                    const vectorPaths: any[] = [];

                    pathElements.forEach((pathEl, idx) => {
                        const d = pathEl.getAttribute('d');
                        if (d) {
                            try {
                                const parsed = (svgPathParser as any).parse(d);
                                vectorPaths.push({
                                    id: Math.random().toString(36).substr(2, 9),
                                    name: pathEl.getAttribute('id') || `Path ${idx + 1}`,
                                    visible: true,
                                    locked: false,
                                    closed: d.toLowerCase().includes('z'),
                                    nodes: parsed.filter((p: any) => 'x' in p && 'y' in p).map((p: any) => ({
                                        id: Math.random().toString(36).substr(2, 9),
                                        x: (p as any).x,
                                        y: (p as any).y,
                                        handleIn: null,
                                        handleOut: null,
                                        type: 'corner'
                                    })),
                                    createdAt: Date.now(),
                                    updatedAt: Date.now()
                                });
                            } catch (e) {
                                console.warn('Failed to parse SVG path:', d);
                            }
                        }
                    });

                    return {
                        type,
                        layers: [this.createLayer(file.name, svgCanvas)],
                        content: {
                            layers: [],
                            activeLayerId: null,
                            canvasSize: { width: svgCanvas.width, height: svgCanvas.height },
                            selection: null,
                            guides: [],
                            paths: vectorPaths,
                            activePathId: vectorPaths.length > 0 ? vectorPaths[0].id : null
                        }
                    };
                case 'pdf':
                    return await this.importPDF(file);
                case 'psd':
                    return await this.importPSD(file);
                case 'tiff':
                    return await this.importTIFF(file);
                case 'shrimp':
                    return { type, error: 'Use loadFromShrimpFile for .shrimp files' };
                default:
                    return { type, error: 'Unsupported file format' };
            }
        } catch (err) {
            console.error('Import failed:', err);
            return { type, error: (err as Error).message };
        }
    }

    private static async importPSD(file: File): Promise<ImportResult> {
        const buffer = await file.arrayBuffer();
        const worker = this.getWorker();

        return new Promise((resolve) => {
            const handler = (e: MessageEvent) => {
                if (e.data.name === file.name) {
                    worker.removeEventListener('message', handler);
                    if (e.data.type === 'PSD_SUCCESS') {
                        const psd = e.data.psd;
                        const layers: Layer[] = [];

                        const mapLayers = (psdLayers: any[]) => {
                            for (const psdLayer of psdLayers) {
                                if (psdLayer.imageData) {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = psdLayer.imageData.width;
                                    canvas.height = psdLayer.imageData.height;
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) {
                                        ctx.putImageData(psdLayer.imageData, 0, 0);
                                    }

                                    layers.push({
                                        id: Math.random().toString(36).substr(2, 9),
                                        name: psdLayer.name || `Layer ${layers.length + 1}`,
                                        visible: psdLayer.hidden === false,
                                        locked: false,
                                        opacity: Math.round((psdLayer.opacity ?? 1) * 100),
                                        blendMode: (psdLayer.blendMode as any) || 'normal',
                                        data: canvas,
                                        filters: [],
                                        x: psdLayer.left || 0,
                                        y: psdLayer.top || 0,
                                        type: 'layer'
                                    });
                                }
                                if (psdLayer.children) {
                                    mapLayers(psdLayer.children);
                                }
                            }
                        };

                        mapLayers(psd.children || []);

                        if (layers.length > 0) {
                            resolve({
                                type: 'psd',
                                layers,
                                content: {
                                    layers,
                                    activeLayerId: layers[layers.length - 1].id,
                                    canvasSize: { width: psd.width, height: psd.height },
                                    selection: null,
                                    guides: [],
                                    paths: [],
                                    activePathId: null
                                }
                            });
                        } else {
                            resolve({ type: 'psd', error: 'No visible layers found in PSD' });
                        }
                    } else {
                        resolve({ type: 'psd', error: e.data.error });
                    }
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'PSD', data: buffer, name: file.name }, [buffer]);
        });
    }

    private static async importTIFF(file: File): Promise<ImportResult> {
        const buffer = await file.arrayBuffer();
        const worker = this.getWorker();

        return new Promise((resolve) => {
            const handler = (e: MessageEvent) => {
                if (e.data.name === file.name) {
                    worker.removeEventListener('message', handler);
                    if (e.data.type === 'TIFF_SUCCESS') {
                        const { rgba, width, height } = e.data;
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
                            ctx.putImageData(imageData, 0, 0);
                            resolve({
                                type: 'tiff',
                                layers: [this.createLayer(file.name, canvas)]
                            });
                        } else {
                            resolve({ type: 'tiff', error: 'Failed to create canvas' });
                        }
                    } else {
                        resolve({ type: 'tiff', error: e.data.error });
                    }
                }
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ type: 'TIFF', data: buffer, name: file.name }, [buffer]);
        });
    }

    private static async importPDF(file: File): Promise<ImportResult> {
        try {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

            const buffer = await file.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: buffer });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: canvas.getContext('2d')!,
                viewport: viewport
            } as any;
            await page.render(renderContext).promise;

            return {
                type: 'pdf',
                layers: [this.createLayer(file.name, canvas)]
            };
        } catch (err) {
            return { type: 'pdf', error: (err as Error).message };
        }
    }

    private static createLayer(name: string, canvas: HTMLCanvasElement): Layer {
        return {
            id: Math.random().toString(36).substr(2, 9),
            name,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            data: canvas,
            filters: [],
            x: 0,
            y: 0,
            type: 'layer'
        };
    }
}
