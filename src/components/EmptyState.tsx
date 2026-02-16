import { useState, lazy, Suspense } from 'react'
import { FolderOpen, ClipboardPaste, Image, FilePlus } from 'lucide-react'
import ShrimpIcon from './ShrimpIcon'
const NewImageDialog = lazy(() => import('./NewImageDialog'))

interface EmptyStateProps {
    onLoadSample: () => void
    onOpenFile: () => void
    onPasteClipboard: () => void
}

export default function EmptyState({ onLoadSample, onOpenFile, onPasteClipboard }: EmptyStateProps) {
    const [showNewImage, setShowNewImage] = useState(false)

    return (
        <div className="empty-state">
            <div className="empty-state-card">
                <div className="empty-state-logo">
                    <div className="empty-state-logo-glow" />
                    <ShrimpIcon size={48} strokeWidth={1.5} />
                </div>
                <h1 className="empty-state-title">Welcome to SHRIMP</h1>
                <p className="empty-state-subtitle">Create or open an image to get started</p>
                <div className="empty-state-actions">
                    <button className="empty-state-btn primary" onClick={() => setShowNewImage(true)}>
                        <FilePlus size={16} />
                        <span>New File</span>
                    </button>
                    <button className="empty-state-btn" onClick={onOpenFile}>
                        <FolderOpen size={16} />
                        <span>Open (local file)</span>
                    </button>
                    <button className="empty-state-btn" onClick={onPasteClipboard}>
                        <ClipboardPaste size={16} />
                        <span>Paste from Clipboard</span>
                    </button>
                    <button className="empty-state-btn" onClick={onLoadSample}>
                        <Image size={16} />
                        <span>Sample Image</span>
                    </button>
                </div>
            </div>
            <Suspense fallback={null}>
                {showNewImage && <NewImageDialog open={showNewImage} onClose={() => setShowNewImage(false)} />}
            </Suspense>
        </div>
    )
}
