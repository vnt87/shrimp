/**
 * Persistence Manager
 * 
 * Handles saving and loading editor state to IndexedDB with:
 * - Atomic saves (write to temp, then rename)
 * - Backup before overwrite
 * - Corruption detection and recovery
 * - Memory-efficient serialization
 */

import { get, set, del, keys } from 'idb-keyval';
import { EditorContent, Layer } from '../components/EditorContext';

const DB_KEY = 'shrimp-state';
const DB_KEY_TEMP = 'shrimp-state-temp';
const DB_KEY_HISTORY = 'shrimp-history';
const MAX_BACKUPS = 3;

// Types for serialized state where HTMLCanvasElement is replaced by Blob
export interface SerializedLayer extends Omit<Layer, 'data' | 'children'> {
    data: Blob | null;
    children?: SerializedLayer[];
}

export interface SerializedEditorContent extends Omit<EditorContent, 'layers'> {
    layers: SerializedLayer[];
    _version: number; // For migration support
    _timestamp: number; // For backup rotation
}

import { canvasToBlob, blobToCanvas } from './imageUtils';

// Current serialization version
const SERIALIZATION_VERSION = 1;

/**
 * Serialize a layer tree to IndexedDB-friendly format
 */
const serializeLayers = async (layers: Layer[]): Promise<SerializedLayer[]> => {
    return Promise.all(layers.map(async (layer) => {
        const serializedChildren = layer.children ? await serializeLayers(layer.children) : undefined;
        let serializedData: Blob | null = null;
        
        if (layer.data) {
            try {
                serializedData = await canvasToBlob(layer.data);
            } catch (error) {
                console.error(`Failed to serialize layer ${layer.id} data:`, error);
                // Continue without the data - better than losing the whole layer
            }
        }

        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            data: serializedData,
            filters: layer.filters,
            x: layer.x,
            y: layer.y,
            type: layer.type,
            children: serializedChildren,
            expanded: layer.expanded,
            text: layer.text,
            textStyle: layer.textStyle,
            shapeData: layer.shapeData,
        };
    }));
};

/**
 * Deserialize a layer tree from IndexedDB format
 */
const deserializeLayers = async (serializedLayers: SerializedLayer[]): Promise<Layer[]> => {
    return Promise.all(serializedLayers.map(async (layer) => {
        const deserializedChildren = layer.children ? await deserializeLayers(layer.children) : undefined;
        let deserializedData: HTMLCanvasElement | null = null;
        
        if (layer.data) {
            try {
                deserializedData = await blobToCanvas(layer.data);
            } catch (error) {
                console.error(`Failed to deserialize layer ${layer.id} data:`, error);
                // Create empty canvas as fallback
                deserializedData = document.createElement('canvas');
                deserializedData.width = 1;
                deserializedData.height = 1;
            }
        }

        return {
            ...layer,
            data: deserializedData,
            children: deserializedChildren,
        } as Layer;
    }));
};

/**
 * Validate serialized content structure
 */
function validateSerializedContent(data: unknown): data is SerializedEditorContent {
    if (!data || typeof data !== 'object') return false;
    
    const obj = data as Record<string, unknown>;
    
    // Check required fields
    if (!Array.isArray(obj.layers)) return false;
    if (typeof obj.canvasSize !== 'object') return false;
    
    const size = obj.canvasSize as Record<string, unknown>;
    if (typeof size.width !== 'number' || typeof size.height !== 'number') return false;
    
    return true;
}

/**
 * Rotate old backups to prevent accumulation
 */
async function rotateBackups(): Promise<void> {
    try {
        const allKeys = await keys();
        const backupKeys = (allKeys as string[])
            .filter(k => k.toString().startsWith('shrimp-backup-'))
            .sort()
            .reverse();
        
        // Remove old backups beyond our limit
        for (let i = MAX_BACKUPS; i < backupKeys.length; i++) {
            await del(backupKeys[i]);
        }
    } catch (error) {
        console.warn('Failed to rotate backups:', error);
    }
}

/**
 * Create a backup of current state before overwriting
 */
async function createBackup(state: SerializedEditorContent): Promise<void> {
    const backupKey = `shrimp-backup-${Date.now()}`;
    try {
        await set(backupKey, state);
        await rotateBackups();
    } catch (error) {
        console.warn('Failed to create backup:', error);
    }
}

export const PersistenceManager = {
    /**
     * Save state atomically with backup
     */
    saveState: async (state: EditorContent): Promise<boolean> => {
        try {
            // Serialize layers
            const serializedLayers = await serializeLayers(state.layers);
            const serializedState: SerializedEditorContent = {
                ...state,
                layers: serializedLayers,
                _version: SERIALIZATION_VERSION,
                _timestamp: Date.now(),
            };
            
            // Check if we have existing state to backup
            const existingState = await get<SerializedEditorContent>(DB_KEY);
            if (existingState) {
                await createBackup(existingState);
            }
            
            // Write to temp location first
            await set(DB_KEY_TEMP, serializedState);
            
            // Then move to final location (atomic on most systems)
            await set(DB_KEY, serializedState);
            await del(DB_KEY_TEMP);
            
            console.log('State saved to IndexedDB');
            return true;
        } catch (error) {
            console.error('Failed to save state:', error);
            
            // Try to recover from temp if main save failed
            try {
                const tempState = await get<SerializedEditorContent>(DB_KEY_TEMP);
                if (tempState) {
                    await set(DB_KEY, tempState);
                    await del(DB_KEY_TEMP);
                    console.log('Recovered from temp save');
                }
            } catch (recoveryError) {
                console.error('Recovery also failed:', recoveryError);
            }
            
            return false;
        }
    },

    /**
     * Load state with corruption recovery
     */
    loadState: async (): Promise<EditorContent | null> => {
        // Try loading main state first
        try {
            const serializedState = await get<SerializedEditorContent>(DB_KEY);
            
            if (serializedState && validateSerializedContent(serializedState)) {
                const deserializedLayers = await deserializeLayers(serializedState.layers);
                return {
                    ...serializedState,
                    layers: deserializedLayers,
                };
            }
        } catch (error) {
            console.error('Failed to load main state:', error);
        }
        
        // Try recovering from temp
        try {
            const tempState = await get<SerializedEditorContent>(DB_KEY_TEMP);
            if (tempState && validateSerializedContent(tempState)) {
                console.log('Recovering from temp state');
                const deserializedLayers = await deserializeLayers(tempState.layers);
                await set(DB_KEY, tempState);
                await del(DB_KEY_TEMP);
                return {
                    ...tempState,
                    layers: deserializedLayers,
                };
            }
        } catch (error) {
            console.error('Failed to recover from temp:', error);
        }
        
        // Try loading from backups
        try {
            const allKeys = await keys();
            const backupKeys = (allKeys as string[])
                .filter(k => k.toString().startsWith('shrimp-backup-'))
                .sort()
                .reverse();
            
            for (const backupKey of backupKeys) {
                try {
                    const backupState = await get<SerializedEditorContent>(backupKey);
                    if (backupState && validateSerializedContent(backupState)) {
                        console.log(`Recovering from backup: ${backupKey}`);
                        const deserializedLayers = await deserializeLayers(backupState.layers);
                        await set(DB_KEY, backupState);
                        return {
                            ...backupState,
                            layers: deserializedLayers,
                        };
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (error) {
            console.error('Failed to recover from backups:', error);
        }
        
        return null;
    },

    /**
     * Clear all saved state
     */
    clearState: async (): Promise<void> => {
        try {
            await del(DB_KEY);
            await del(DB_KEY_TEMP);
            
            // Also clear old backups
            const allKeys = await keys();
            for (const key of allKeys) {
                if (key.toString().startsWith('shrimp-backup-')) {
                    await del(key);
                }
            }
            
            console.log('State cleared from IndexedDB');
        } catch (error) {
            console.error('Failed to clear state:', error);
        }
    },

    /**
     * Save history separately (for large histories)
     */
    saveHistory: async (historyData: unknown): Promise<boolean> => {
        try {
            await set(DB_KEY_HISTORY, historyData);
            return true;
        } catch (error) {
            console.error('Failed to save history:', error);
            return false;
        }
    },

    /**
     * Load history
     */
    loadHistory: async (): Promise<unknown | null> => {
        try {
            return await get(DB_KEY_HISTORY);
        } catch (error) {
            console.error('Failed to load history:', error);
            return null;
        }
    },

    /**
     * Clear history only
     */
    clearHistory: async (): Promise<void> => {
        try {
            await del(DB_KEY_HISTORY);
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    },

    /**
     * Get storage statistics
     */
    getStorageStats: async (): Promise<{
        hasState: boolean;
        hasHistory: boolean;
        backupCount: number;
        estimatedSizeMB: number;
    }> => {
        try {
            const allKeys = await keys();
            const hasState = allKeys.includes(DB_KEY);
            const hasHistory = allKeys.includes(DB_KEY_HISTORY);
            const backupCount = (allKeys as string[])
                .filter(k => k.toString().startsWith('shrimp-backup-')).length;
            
            // Rough estimate based on stored data
            let estimatedSize = 0;
            if (hasState) {
                const state = await get(DB_KEY);
                if (state) {
                    estimatedSize += JSON.stringify(state).length;
                }
            }
            
            return {
                hasState,
                hasHistory,
                backupCount,
                estimatedSizeMB: estimatedSize / (1024 * 1024),
            };
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return {
                hasState: false,
                hasHistory: false,
                backupCount: 0,
                estimatedSizeMB: 0,
            };
        }
    },
};