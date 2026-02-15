import { useEffect } from 'react'
import { X, Github, ExternalLink, FileText } from 'lucide-react'
import ShrimpIcon from './ShrimpIcon'

const APP_VERSION = '0.1.0'

export default function AboutDialog({ onClose }: { onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="about-overlay" onClick={onClose}>
            <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
                {/* Title bar */}
                <div className="about-titlebar">
                    <span className="about-titlebar-text">About SHRIMP</span>
                    <div className="about-titlebar-close" onClick={onClose}>
                        <X size={14} />
                    </div>
                </div>

                {/* Body */}
                <div className="about-body">
                    <div className="about-logo">
                        <ShrimpIcon size={48} />
                    </div>

                    <h1 className="about-app-name">SHRIMP</h1>
                    <span className="about-version">Version {APP_VERSION}</span>
                    <div className="about-tagline">
                        <div style={{ marginBottom: '4px' }}>
                            <strong>S</strong>imple <strong>H</strong>i-<strong>R</strong>es <strong>I</strong>mage <strong>M</strong>anipulation <strong>P</strong>rogram
                        </div>
                        <div>A web-based image editor inspired by GIMP</div>
                    </div>

                    <div className="about-divider" />

                    <div className="about-info-grid">
                        <div className="about-info-row">
                            <span className="about-info-label">Author</span>
                            <a
                                className="about-info-link"
                                href="https://namvu.net"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Nam Vu
                                <ExternalLink size={11} />
                            </a>
                        </div>

                        <div className="about-info-row">
                            <span className="about-info-label">GitHub</span>
                            <a
                                className="about-info-link"
                                href="https://github.com/vnt87/shrimp"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Github size={13} />
                                vnt87/shrimp
                                <ExternalLink size={11} />
                            </a>
                        </div>

                        <div className="about-info-row">
                            <span className="about-info-label">Changelog</span>
                            <a
                                className="about-info-link about-info-link--muted"
                                href="#"
                                onClick={(e) => e.preventDefault()}
                            >
                                <FileText size={13} />
                                Coming soon
                            </a>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="about-footer">
                    <button className="pref-btn pref-btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}
