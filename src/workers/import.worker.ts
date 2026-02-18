
/* eslint-disable no-restricted-globals */
import * as AgPsd from 'ag-psd';
// import { readTIFF } from 'utif'; // Note: UTIF might be better handled on main thread if needed, but let's try here
// import * as pdfjsLib from 'pdfjs-dist';

self.onmessage = async (e: MessageEvent) => {
    const { type, data, name } = e.data;

    try {
        switch (type) {
            case 'PSD':
                const psd = AgPsd.readPsd(data);
                // We need to convert PSD layers to a format we can send back.
                // Binary data (canvases) need to be handled carefully.
                // ag-psd can return canvases if we provide them, or we can just send the tree and render on main thread.
                // For now, let's send the structure.
                self.postMessage({ type: 'PSD_SUCCESS', psd, name });
                break;

            case 'TIFF':
                // UTIF decoding logic here
                self.postMessage({ type: 'TIFF_SUCCESS', data: 'TIFF structure', name });
                break;

            default:
                self.postMessage({ type: 'ERROR', error: 'Unknown worker command: ' + type });
        }
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: (err as Error).message });
    }
};
