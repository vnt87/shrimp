import { useEditor } from './EditorContext'
import { X, Plus } from 'lucide-react'

export default function DocumentTabs() {
    const {
        documents,
        activeDocumentId,
        setActiveDocumentId,
        closeDocument,
        addDocument
    } = useEditor()

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
                                    closeDocument(doc.id)
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
        </div>
    )
}
