import React, { useEffect, useState } from 'react';
import { X, Key, Globe, Box, Settings, AlertCircle, Sparkles } from 'lucide-react';
import { useIntegrationStore } from '../hooks/useIntegrationStore';
// import { useLanguage } from '../i18n/LanguageContext'; // context not used yet for this dialog's content

interface IntegrationsDialogProps {
    open: boolean;
    onClose: () => void;
}

interface SidebarItem {
    id: string
    label: string
    icon?: React.ReactNode
}

export default function IntegrationsDialog({ open, onClose }: IntegrationsDialogProps) {
    const settings = useIntegrationStore();
    // const { t } = useLanguage();
    const [activeItem, setActiveItem] = useState<string>('AI Generation');

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        if (open) {
            document.addEventListener('keydown', onKey);
        }
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const sidebarItems: SidebarItem[] = [
        { id: 'AI Generation', label: 'AI Generation', icon: <Sparkles size={14} /> },
        // Future integrations: Unsplash, S3, etc.
    ];

    const renderContent = () => {
        switch (activeItem) {
            case 'AI Generation':
                return (
                    // Reusing the AI configuration content
                    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Master Toggle */}
                        <div style={{ padding: '0 0 20px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Enable AI Features</h3>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Unlock generative fill, image generation, and smart tools.
                                </div>
                            </div>
                            <div
                                className="header-toggle"
                                onClick={() => settings.updateSettings({ isAIEnabled: !settings.isAIEnabled })}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                                <div className={`toggle ${settings.isAIEnabled ? 'on' : 'off'}`} />
                            </div>
                        </div>

                        {settings.isAIEnabled ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <FormSection title="Provider Configuration">
                                    <InputRow label="Protocol">
                                        <div className="toggle-group" style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', padding: 2, borderRadius: 6 }}>
                                            {(['openai', 'anthropic', 'gemini'] as const).map(provider => (
                                                <button
                                                    key={provider}
                                                    onClick={() => settings.updateSettings({ aiProvider: provider })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px 12px',
                                                        borderRadius: 4,
                                                        border: 'none',
                                                        background: settings.aiProvider === provider ? 'var(--accent-active)' : 'transparent',
                                                        color: settings.aiProvider === provider ? 'white' : 'var(--text-secondary)',
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        textTransform: 'capitalize',
                                                        height: 24
                                                    }}
                                                >
                                                    {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google Gemini'}
                                                </button>
                                            ))}
                                        </div>
                                    </InputRow>

                                    <InputRow label="Base URL" icon={<Globe size={14} />}>
                                        <input
                                            type="text"
                                            className="dialogue-input"
                                            value={settings.baseUrl}
                                            onChange={(e) => settings.updateSettings({ baseUrl: e.target.value })}
                                            placeholder="https://api.openai.com/v1"
                                            style={{ width: '100%', color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                                        />
                                    </InputRow>

                                    <InputRow label="API Key" icon={<Key size={14} />}>
                                        <input
                                            type="password"
                                            className="dialogue-input"
                                            value={settings.apiKey}
                                            onChange={(e) => settings.updateSettings({ apiKey: e.target.value })}
                                            placeholder="sk-..."
                                            style={{ width: '100%', color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                                        />
                                    </InputRow>

                                    <InputRow label="Model ID" icon={<Box size={14} />}>
                                        <input
                                            type="text"
                                            className="dialogue-input"
                                            value={settings.modelId}
                                            onChange={(e) => settings.updateSettings({ modelId: e.target.value })}
                                            placeholder="gpt-4, claude-3-opus, etc."
                                            style={{ width: '100%', color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                                        />
                                    </InputRow>
                                </FormSection>

                                <div style={{
                                    padding: 12,
                                    background: 'var(--bg-1)',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    gap: 10,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                    <div>
                                        Settings are saved automatically.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                <Settings size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                                <div>Enable AI features to configure connection details.</div>
                            </div>
                        )}
                    </div>
                );
            default:
                return <div>Select an integration</div>;
        }
    };

    return (
        <div className="pref-overlay" onClick={onClose}>
            <div className="pref-dialog" onClick={(e) => e.stopPropagation()}>
                {/* Title bar */}
                <div className="pref-titlebar">
                    <span className="pref-titlebar-text">Integrations</span>
                    <div className="pref-titlebar-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                {/* Body */}
                <div className="pref-body">
                    {/* Sidebar */}
                    <div className="pref-sidebar">
                        {sidebarItems.map((item) => (
                            <div key={item.id}>
                                <div
                                    className={`pref-sidebar-item${activeItem === item.id ? ' active' : ''}`}
                                    onClick={() => setActiveItem(item.id)}
                                >
                                    <span style={{ width: 12, display: 'inline-block' }} />
                                    {item.icon && <span className="pref-sidebar-icon">{item.icon}</span>}
                                    <span className="pref-sidebar-label">{item.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="pref-content">
                        <h2 className="pref-page-title">{activeItem}</h2>
                        <div className="pref-page-divider" />
                        <div className="pref-page-body">
                            {renderContent()}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pref-footer">
                    <div className="pref-footer-right">
                        <button className="pref-btn pref-btn-primary" onClick={onClose}>
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FormSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {children}
            </div>
        </div>
    );
}

function InputRow({ label, icon, children }: { label: string, icon?: React.ReactNode, children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {icon && <span style={{ color: 'var(--text-tertiary)' }}>{icon}</span>}
                {label}
            </label>
            <div>
                {children}
            </div>
        </div>
    );
}
