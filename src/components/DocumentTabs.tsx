import { useEditor } from './EditorContext'
import { X, Plus } from 'lucide-react'
import { useState } from 'react'
import ConfirmationDialog from './ConfirmationDialog'
import { useLanguage } from '../i18n/LanguageContext'

export default function DocumentTabs() {
    const {
        documents,
        activeDocumentId,
        setActiveDocumentId,
        closeDocument,
        addDocument
    } = useEditor()
    const { t } = useLanguage()

    const [docToClose, setDocToClose] = useState<{ id: string, name: string } | null>(null)

    return (
        <div className="document-tabs">
            <div className="tabs-scroll-container">
                {documents.map((doc) => {
                    const isActive = doc.id === activeDocumentId
                    return (
                        <div
                            key={doc.id}
                            className={`tab-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveDocumentId(doc.id)}
                            title={doc.name}
                        >
                            <span className="tab-name">{doc.name}</span>
                            <button
                                className="tab-close-btn"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setDocToClose({ id: doc.id, name: doc.name })
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )
                })}
            </div>
            <button
                className="tab-add-btn"
                onClick={() => addDocument()}
                title="New Document"
            >
                <Plus size={14} />
            </button>

            {docToClose && (
                <ConfirmationDialog
                    title={t('dialog.confirm.close_document.title')}
                    message={t('dialog.confirm.close_document.message').replace('{name}', docToClose.name)}
                    confirmLabel={t('dialog.confirm.close_document.confirm')}
                    cancelLabel={t('dialog.confirm.close_document.cancel')}
                    confirmVariant="danger"
                    onConfirm={() => {
                        closeDocument(docToClose.id)
                        setDocToClose(null)
                    }}
                    onCancel={() => setDocToClose(null)}
                />
            )}
        </div>
    )
}
