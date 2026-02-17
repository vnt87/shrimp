
import { useState, useEffect } from 'react';

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface IntegrationSettings {
    isAIEnabled: boolean;
    aiProvider: AIProvider;
    apiKey: string;
    baseUrl: string;
    modelId: string;
}

const DEFAULT_SETTINGS: IntegrationSettings = {
    isAIEnabled: false,
    aiProvider: 'custom',
    apiKey: '',
    baseUrl: 'http://127.0.0.1:8045/v1',
    modelId: 'gemini-3-pro-image',
};

const STORAGE_KEY = 'shrimp_integrations_v1';

// Simple event emitter for updates
const listeners = new Set<() => void>();

let currentSettings: IntegrationSettings = { ...DEFAULT_SETTINGS };

// Initialize from storage immediately
try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
} catch (e) {
    console.error('Failed to load integration settings', e);
}

export const integrationStore = {
    get: () => currentSettings,
    set: (newSettings: Partial<IntegrationSettings>) => {
        currentSettings = { ...currentSettings, ...newSettings };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        } catch (e) {
            console.error('Failed to save integration settings', e);
        }
        listeners.forEach(l => l());
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }
};

export function useIntegrationStore() {
    const [settings, setSettings] = useState(integrationStore.get());

    useEffect(() => {
        return integrationStore.subscribe(() => {
            setSettings(integrationStore.get());
        });
    }, []);

    const updateSettings = (updates: Partial<IntegrationSettings>) => {
        integrationStore.set(updates);
    };

    return {
        ...settings,
        updateSettings
    };
}
