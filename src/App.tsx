import { useEffect, useState, useCallback } from 'react'
import { ThemeProvider } from './components/ThemeContext'
import { EditorProvider } from './components/EditorContext'
import { PresetsProvider } from './components/PresetsContext'
import Header from './components/Header'
import ToolOptionsBar from './components/ToolOptionsBar'
import Toolbox from './components/Toolbox'
import Canvas from './components/Canvas'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'
import DocumentTabs from './components/DocumentTabs'
import { LayoutProvider } from './components/LayoutContext'

export interface ToolOptions {
    brushSize: number
    brushOpacity: number
    brushHardness: number
    fillThreshold: number
    antialiasing: boolean
    // Text tools
    fontSize: number
    fontFamily: string
    textColor: string
    textAlign: 'left' | 'center' | 'right' | 'justify'
    textBold: boolean
    textItalic: boolean
    textLetterSpacing: number
    textLineHeight: number
    textUnderline: boolean
    textStrikethrough: boolean
    // Crop tools
    cropDeletePixels: boolean
    cropFixedRatio: boolean
    cropAspectRatio: number
    cropHighlightOpacity: number
    cropGuides: 'none' | 'center' | 'thirds' | 'fifth'
    // Bucket options
    bucketFillType: 'fg' | 'bg'
    bucketAffectedArea: 'similar' | 'selection'
    bucketSampleMerged: boolean
    bucketOpacity: number
    // Gradient options
    gradientType: 'linear' | 'radial'
    gradientReverse: boolean
    gradientOpacity: number
    gradientAffectedArea: 'layer' | 'selection'
    // Picker options
    pickerTarget: 'fg' | 'bg'
    // Zoom options
    zoomDirection: 'in' | 'out'
    // Path options
    pathMode: 'design' | 'edit' | 'move'
    pathPolygonal: boolean
    // Clone options
    cloneSampleMode: 'current' | 'all'
    cloneTarget: 'active' | 'new'
}

const defaultToolOptions: ToolOptions = {
    brushSize: 10,
    brushOpacity: 100,
    brushHardness: 100,
    fillThreshold: 15,
    antialiasing: true,
    fontSize: 24,
    fontFamily: 'Inter',
    textColor: '#000000',
    textAlign: 'left',
    textBold: false,
    textItalic: false,
    textLetterSpacing: 0,
    textLineHeight: 1.2,
    textUnderline: false,
    textStrikethrough: false,
    cropDeletePixels: true,
    cropFixedRatio: false,
    cropAspectRatio: 1,
    cropHighlightOpacity: 50,
    cropGuides: 'thirds',
    bucketFillType: 'fg',
    bucketAffectedArea: 'similar',
    bucketSampleMerged: false,
    bucketOpacity: 100,
    gradientType: 'linear',
    gradientReverse: false,
    gradientOpacity: 100,
    gradientAffectedArea: 'layer',
    pickerTarget: 'fg',
    zoomDirection: 'in',
    pathMode: 'design',
    pathPolygonal: false,
    cloneSampleMode: 'current',
    cloneTarget: 'active',
}

export default function App() {
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
    const [activeTool, setActiveTool] = useState<string>('move')
    const [toolOptions, setToolOptions] = useState<ToolOptions>(defaultToolOptions)

    // Prevent the browser from zooming the entire UI when the user performs a
    // pinch gesture (or Ctrl+Wheel) anywhere outside the canvas viewport.
    // Pinch-to-zoom on the canvas is handled by Canvas.tsx's handleWheel instead.
    useEffect(() => {
        const preventBrowserZoom = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault()
            }
        }
        // { passive: false } is required to be able to call preventDefault()
        document.addEventListener('wheel', preventBrowserZoom, { passive: false })
        return () => document.removeEventListener('wheel', preventBrowserZoom)
    }, [])

    const updateToolOption = useCallback(<K extends keyof ToolOptions>(key: K, value: ToolOptions[K]) => {
        setToolOptions(prev => ({ ...prev, [key]: value }))
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                return
            }


            const isCmd = e.metaKey || e.ctrlKey

            // Ignore shortcuts if Cmd/Ctrl is pressed (handled by global shortcuts or browser)
            if (isCmd) return

            switch (e.key.toLowerCase()) {
                case 'c': setActiveTool('crop'); break
                case 'v': setActiveTool('move'); break
                case 'b': setActiveTool('brush'); break
                case 'n': setActiveTool('pencil'); break
                case 'e':
                    if (e.shiftKey) setActiveTool('eraser')
                    else setActiveTool('ellipse-select')
                    break
                case 'g':
                    if (e.shiftKey) setActiveTool('gradient')
                    else setActiveTool('bucket')
                    break
                case 'r': setActiveTool('rect-select'); break
                case 'i': setActiveTool('picker'); break
                case 't': setActiveTool('text'); break
                case 'z': setActiveTool('zoom'); break
                case 'p': setActiveTool('paths'); break
                case 'escape': setActiveTool('move'); break
                case '[':
                    setToolOptions(prev => ({
                        ...prev,
                        brushSize: Math.max(1, prev.brushSize - 2)
                    }))
                    break
                case ']':
                    setToolOptions(prev => ({
                        ...prev,
                        brushSize: Math.min(500, prev.brushSize + 2)
                    }))
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <ThemeProvider>
            <PresetsProvider>
                <LayoutProvider>
                    <EditorProvider>
                        <div className="app">
                            <Header onToolSelect={setActiveTool} />
                            <ToolOptionsBar activeTool={activeTool} toolOptions={toolOptions} onToolOptionChange={updateToolOption} />
                            <div className="main-content">
                                <Toolbox activeTool={activeTool} onToolSelect={setActiveTool} />
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden', background: 'var(--bg-canvas)' }}>
                                    <DocumentTabs />
                                    <Canvas
                                        onCursorMove={setCursorPos}
                                        activeTool={activeTool}
                                        onToolChange={setActiveTool}
                                        toolOptions={toolOptions}
                                    />
                                </div>
                                <RightPanel />
                            </div>
                            <StatusBar cursorPos={cursorPos} />
                        </div>
                    </EditorProvider>
                </LayoutProvider>
            </PresetsProvider>
        </ThemeProvider>
    )
}
