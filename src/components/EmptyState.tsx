import { FolderOpen, ClipboardPaste, Image } from 'lucide-react'
import ShrimpIcon from './ShrimpIcon'

interface EmptyStateProps {
    onLoadSample: () => void
    onOpenFile: () => void
    onPasteClipboard: () => void
}

export default function EmptyState({ onLoadSample, onOpenFile, onPasteClipboard }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-state-card">
                <div className="empty-state-logo">
                    <div className="empty-state-logo-glow" />
                    <ShrimpIcon size={48} strokeWidth={1.5} />
                </div>
                <h1 className="empty-state-title">Welcome to SHRIMP</h1>
                <p className="empty-state-subtitle">Open an image to get started</p>
                <div className="empty-state-actions">
                    <button className="empty-state-btn" onClick={onOpenFile}>
                        <FolderOpen size={16} />
                        <span>Open (local file)</span>
                    </button>
                    <button className="empty-state-btn" onClick={onPasteClipboard}>
                        <ClipboardPaste size={16} />
                        <span>Paste from Clipboard</span>
                    </button>
                    <button className="empty-state-btn primary" onClick={onLoadSample}>
                        <Image size={16} />
                        <span>Sample Image</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
