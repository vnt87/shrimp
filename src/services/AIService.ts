
import { integrationStore } from '../hooks/useIntegrationStore';

interface GenerateImageResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
    }>;
}

export const AIService = {
    /**
     * Generates an image based on the provided prompt and size.
     * Returns the image URL.
     */
    generateImage: async (prompt: string, size: string = "1024x1024"): Promise<string> => {
        const settings = integrationStore.get();

        if (!settings.isAIEnabled) {
            throw new Error("AI features are disabled. Enable them in Edit > Integrations.");
        }

        const { baseUrl, apiKey, modelId } = settings;
        const url = `${baseUrl}/images/generations`; // OpenAI compatible endpoint

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    prompt,
                    model: modelId,
                    n: 1,
                    size,
                    response_format: "url"
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
            }

            const data: GenerateImageResponse = await response.json();

            if (!data.data || data.data.length === 0 || !data.data[0].url) {
                throw new Error("No image data returned from API");
            }

            return data.data[0].url;
        } catch (error) {
            console.error("AI Image Generation failed:", error);
            throw error;
        }
    }
};
