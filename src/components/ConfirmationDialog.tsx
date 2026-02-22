import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ConfirmationDialogProps {
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    onConfirm: () => void
    onCancel: () => void
    confirmVariant?: 'primary' | 'danger'
}

export default function ConfirmationDialog({
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    confirmVariant = 'primary'
}: ConfirmationDialogProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onCancel()
            } else if (e.key === 'Enter') {
                e.stopPropagation()
                onConfirm()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onCancel, onConfirm])

    return (
        <div className="about-overlay" onClick={onCancel}>
            <div className="about-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="about-titlebar">
                    <span className="about-titlebar-text">{title}</span>
                    <div className="about-titlebar-close" onClick={onCancel}>
                        <X size={14} />
                    </div>
                </div>

                <div className="about-body">
                    <div style={{ padding: '10px 0', lineHeight: '1.5' }}>
                        {message}
                    </div>
                </div>

                <div className="about-footer" style={{ gap: '10px' }}>
                    <button className="pref-btn" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        className={`pref-btn ${confirmVariant === 'danger' ? 'pref-btn-danger' : 'pref-btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
