
import { get, set, del } from 'idb-keyval';
import { EditorContent, Layer } from '../components/EditorContext';

const DB_KEY = 'webgimp-state';

// Types for serialized state where HTMLCanvasElement is replaced by Blob
export interface SerializedLayer extends Omit<Layer, 'data' | 'children'> {
    data: Blob | null;
    children?: SerializedLayer[];
}

export interface SerializedEditorContent extends Omit<EditorContent, 'layers'> {
    layers: SerializedLayer[];
}

import { canvasToBlob, blobToCanvas } from './imageUtils';

// Serialize Layer Tree
const serializeLayers = async (layers: Layer[]): Promise<SerializedLayer[]> => {
    return Promise.all(layers.map(async (layer) => {
        const serializedchildren = layer.children ? await serializeLayers(layer.children) : undefined;
        let serializedData: Blob | null = null;
        if (layer.data) {
            serializedData = await canvasToBlob(layer.data);
        }

        return {
            ...layer,
            data: serializedData,
            children: serializedchildren,
        };
    }));
};

// Deserialize Layer Tree
const deserializeLayers = async (serializedLayers: SerializedLayer[]): Promise<Layer[]> => {
    return Promise.all(serializedLayers.map(async (layer) => {
        const deserializedChildren = layer.children ? await deserializeLayers(layer.children) : undefined;
        let deserializedData: HTMLCanvasElement | null = null;
        if (layer.data) {
            deserializedData = await blobToCanvas(layer.data);
        }

        return {
            ...layer,
            data: deserializedData,
            children: deserializedChildren,
        } as Layer;
    }));
};

export const PersistenceManager = {
    saveState: async (state: EditorContent) => {
        try {
            const serializedLayers = await serializeLayers(state.layers);
            const serializedState: SerializedEditorContent = {
                ...state,
                layers: serializedLayers,
            };
            await set(DB_KEY, serializedState);
            console.log('State saved to IndexedDB');
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    },

    loadState: async (): Promise<EditorContent | null> => {
        try {
            const serializedState = await get<SerializedEditorContent>(DB_KEY);
            if (!serializedState) return null;

            const deserializedLayers = await deserializeLayers(serializedState.layers);
            return {
                ...serializedState,
                layers: deserializedLayers,
            };
        } catch (error) {
            console.error('Failed to load state:', error);
            return null;
        }
    },

    clearState: async () => {
        try {
            await del(DB_KEY);
            console.log('State cleared from IndexedDB');
        } catch (error) {
            console.error('Failed to clear state:', error);
        }
    }
};
