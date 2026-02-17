
import React, { useState } from 'react';
import { Sparkles, Check, Loader2, AlertCircle } from 'lucide-react';
import { AIService } from '../services/AIService';

interface GenerateImageDialogProps {
    onClose: () => void;
    onLayerCreate: (url: string) => void;
}

const GenerateImageDialog: React.FC<GenerateImageDialogProps> = ({ onClose, onLayerCreate }) => {
    const [prompt, setPrompt] = useState('');
    const [size, setSize] = useState('1024x1024');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const url = await AIService.generateImage(prompt, size);
            setGeneratedImage(url);
        } catch (err: any) {
            setError(err.message || "Failed to generate image");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAccept = () => {
        if (generatedImage) {
            onLayerCreate(generatedImage);
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    return (
        <div className="dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="dialog-content" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
                <div className="dialog-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={16} style={{ color: 'var(--accent-active)' }} />
                        Generate Image
                    </span>
                    <button className="dialog-close-btn" onClick={onClose}>×</button>
                </div>

                <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' }}>

                    {/* Prompt Input */}
                    <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            PROMPT
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the image you want to generate..."
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                resize: 'vertical',
                                minHeight: 80,
                                fontFamily: 'inherit'
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>

                    {/* Size Selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            SIZE
                        </label>
                        <select
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                height: 36
                            }}
                        >
                            <option value="1024x1024">Square (1024x1024)</option>
                            <option value="1344x768">Landscape (1344x768)</option>
                            <option value="768x1344">Portrait (768x1344)</option>
                        </select>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            padding: '10px',
                            background: 'rgba(255, 80, 80, 0.1)',
                            border: '1px solid rgba(255, 80, 80, 0.3)',
                            borderRadius: 4,
                            color: '#ff5050',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    {/* Preview Area */}
                    {(generatedImage || isGenerating) && (
                        <div style={{
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-2)', // Checkered pattern would be nice here ideally
                            minHeight: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}>
                            {isGenerating ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-active)' }} />
                                    <span style={{ fontSize: 12 }}>Generating assets...</span>
                                </div>
                            ) : (
                                <img
                                    src={generatedImage!}
                                    alt="Generated result"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: 320,
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        {!generatedImage ? (
                            <>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '8px 16px', borderRadius: 4, fontSize: 12,
                                        border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                        color: 'var(--text-primary)', cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !prompt.trim()}
                                    style={{
                                        padding: '8px 16px', borderRadius: 4, fontSize: 12,
                                        border: 'none', background: 'var(--accent-active)',
                                        color: '#fff', cursor: isGenerating ? 'default' : 'pointer',
                                        fontWeight: 600,
                                        opacity: (isGenerating || !prompt.trim()) ? 0.6 : 1,
                                        display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    {isGenerating ? 'Generating...' : (
                                        <>
                                            <Sparkles size={14} />
                                            Generate
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setGeneratedImage(null)}
                                    style={{
                                        padding: '8px 16px', borderRadius: 4, fontSize: 12,
                                        border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                        color: 'var(--text-primary)', cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={handleAccept}
                                    style={{
                                        padding: '8px 16px', borderRadius: 4, fontSize: 12,
                                        border: 'none', background: 'var(--accent-active)',
                                        color: '#fff', cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    <Check size={14} />
                                    Accept Image
                                </button>
                            </>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default GenerateImageDialog;
