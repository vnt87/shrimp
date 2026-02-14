import { useEffect, useState } from 'react';
import { getGoogleFontUrl } from '../utils/googleFonts';

export const useGoogleFont = (fontFamily: string) => {
    const [status, setStatus] = useState<'loading' | 'active' | 'error' | 'idle'>('idle');

    useEffect(() => {
        if (!fontFamily)return;

        // Check if it's a built-in font
        const builtInFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'];
        if (builtInFonts.includes(fontFamily)) {
            setStatus('active');
            return;
        }

        const loadFont = async () => {
            setStatus('loading');
            
            // 1. Create link tag if not already there
            const linkId = `google-font-${fontFamily.toLowerCase().replace(/\s+/g, '-')}`;
            let link = document.getElementById(linkId) as HTMLLinkElement;
            
            if (!link){
                link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = getGoogleFontUrl(fontFamily);
                document.head.appendChild(link);
            }

            // 2. Wait for font to be loaded in the browser
            try {
                // Use the FontFace API via document.fonts if available
                if ('fonts' in document) {
                    await (document as any).fonts.load(`12px "${fontFamily}"`);
                    setStatus('active');
                } else {
                    // Fallback: assume it works after a short delay if API not supported
                    setTimeout(() => setStatus('active'), 1000);
                }
            } catch (err) {
                console.error(`Failed to load font: ${fontFamily}`, err);
                setStatus('error');
            }
        };

        loadFont();
    }, [fontFamily]);

    return status;
};
