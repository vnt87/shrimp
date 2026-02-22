/**
 * Error Boundary Components
 * 
 * Provides graceful error handling and recovery for the application.
 * Catches React errors and allows users to recover without losing work.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Trash2, Download } from 'lucide-react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
    onReset?: () => void
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
    errorId: string | null
}

/**
 * Main application error boundary
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        }
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
            errorId: `error-${Date.now()}`,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo })
        
        // Log to console in development
        console.error('Error caught by boundary:', error)
        console.error('Component stack:', errorInfo.componentStack)
        
        // Call optional error handler
        this.props.onError?.(error, errorInfo)
        
        // Store error for potential recovery/debugging
        try {
            const errorLog = {
                timestamp: Date.now(),
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
            }
            localStorage.setItem('shrimp-last-error', JSON.stringify(errorLog))
        } catch {
            // Ignore storage errors
        }
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        })
        this.props.onReset?.()
    }

    handleClearData = (): void => {
        if (confirm('This will clear all saved data and reload the application. Are you sure?')) {
            // Clear all storage
            localStorage.clear()
            sessionStorage.clear()
            // Clear IndexedDB
            indexedDB.deleteDatabase('keyval-store')
            // Reload
            window.location.reload()
        }
    }

    handleExportError = (): void => {
        const errorReport = {
            timestamp: new Date().toISOString(),
            error: {
                message: this.state.error?.message,
                stack: this.state.error?.stack,
            },
            componentStack: this.state.errorInfo?.componentStack,
            userAgent: navigator.userAgent,
            url: window.location.href,
        }
        
        const blob = new Blob([JSON.stringify(errorReport, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `shrimp-error-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div style={styles.container}>
                    <div style={styles.content}>
                        <AlertTriangle size={48} color="#ef4444" />
                        <h1 style={styles.title}>Something went wrong</h1>
                        <p style={styles.message}>
                            The application encountered an unexpected error. Your work may still be recoverable.
                        </p>
                        
                        <div style={styles.errorDetails}>
                            <details>
                                <summary style={styles.summary}>Error Details</summary>
                                <pre style={styles.stack}>
                                    {this.state.error?.message}
                                    {'\n\n'}
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        </div>
                        
                        <div style={styles.actions}>
                            <button style={styles.primaryButton} onClick={this.handleReset}>
                                <RefreshCw size={16} />
                                Try Again
                            </button>
                            <button style={styles.secondaryButton} onClick={() => window.location.reload()}>
                                <RefreshCw size={16} />
                                Reload App
                            </button>
                            <button style={styles.secondaryButton} onClick={this.handleExportError}>
                                <Download size={16} />
                                Export Error
                            </button>
                            <button style={styles.dangerButton} onClick={this.handleClearData}>
                                <Trash2 size={16} />
                                Clear Data & Reset
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Canvas-specific error boundary
 * Provides specialized recovery for canvas rendering errors
 */
export class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        }
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
            errorId: `canvas-error-${Date.now()}`,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo })
        console.error('Canvas error:', error)
        this.props.onError?.(error, errorInfo)
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        })
        this.props.onReset?.()
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={styles.canvasFallback}>
                    <AlertTriangle size={24} color="#facc15" />
                    <span>Canvas rendering error</span>
                    <button style={styles.smallButton} onClick={this.handleReset}>
                        Retry
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

/**
 * Panel-specific error boundary
 * Shows a compact error message within a panel
 */
export class PanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        }
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
            errorId: `panel-error-${Date.now()}`,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo })
        console.error('Panel error:', error)
        this.props.onError?.(error, errorInfo)
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        })
        this.props.onReset?.()
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div style={styles.panelFallback}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <span>Panel error</span>
                    <button style={styles.smallButton} onClick={this.handleReset}>
                        <RefreshCw size={12} />
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

// Styles
const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
        zIndex: 9999,
    },
    content: {
        maxWidth: '500px',
        textAlign: 'center',
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '16px 0 8px',
    },
    message: {
        fontSize: '14px',
        color: '#a0a0a0',
        marginBottom: '24px',
    },
    errorDetails: {
        marginBottom: '24px',
        textAlign: 'left',
    },
    summary: {
        cursor: 'pointer',
        fontSize: '12px',
        color: '#a0a0a0',
        marginBottom: '8px',
    },
    stack: {
        fontSize: '11px',
        backgroundColor: '#2a2a2a',
        padding: '12px',
        borderRadius: '4px',
        overflow: 'auto',
        maxHeight: '200px',
        color: '#f87171',
    },
    actions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center',
    },
    primaryButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
    secondaryButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        backgroundColor: '#374151',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        cursor: 'pointer',
    },
    dangerButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        backgroundColor: '#7f1d1d',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        cursor: 'pointer',
    },
    canvasFallback: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '40px',
        backgroundColor: '#1f2937',
        color: '#d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
    },
    panelFallback: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#1f2937',
        color: '#d1d5db',
        fontSize: '12px',
    },
    smallButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: '#374151',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        cursor: 'pointer',
    },
}

/**
 * Hook to manually trigger error boundary reset
 */
export function useErrorBoundaryReset() {
    const [key, setKey] = React.useState(0)
    
    const reset = React.useCallback(() => {
        setKey(prev => prev + 1)
    }, [])
    
    return { key, reset }
}