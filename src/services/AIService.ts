
interface GenerateImageResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
    }>;
}

const API_URL = 'http://127.0.0.1:8045/v1/images/generations';

export const AIService = {
    /**
     * Generates an image based on the provided prompt and size.
     * Returns the image URL.
     */
    generateImage: async (prompt: string, size: string = "1024x1024"): Promise<string> => {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer not-needed'
                },
                body: JSON.stringify({
                    prompt,
                    model: "gemini-3-pro-image",
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
