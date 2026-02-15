import { useEffect, useState, useCallback } from 'react'
import { ThemeProvider } from './components/ThemeContext'
import { EditorProvider } from './components/EditorContext'
import Header from './components/Header'
import ToolOptionsBar from './components/ToolOptionsBar'
import Toolbox from './components/Toolbox'
import Canvas from './components/Canvas'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

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
    // Picker options
    pickerTarget: 'fg' | 'bg'
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
    cropDeletePixels: true,
    cropFixedRatio: false,
    cropAspectRatio: 1,
    cropHighlightOpacity: 50,
    cropGuides: 'thirds',
    bucketFillType: 'fg',
    bucketAffectedArea: 'similar',
    bucketSampleMerged: false,
    bucketOpacity: 100,
    pickerTarget: 'fg',
}

export default function App() {
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
    const [activeTool, setActiveTool] = useState<string>('move')
    const [toolOptions, setToolOptions] = useState<ToolOptions>(defaultToolOptions)

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
                case 'g': setActiveTool('bucket'); break
                case 'r': setActiveTool('rect-select'); break
                case 'i': setActiveTool('picker'); break
                case 't': setActiveTool('text'); break
                case 'z': setActiveTool('zoom'); break
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
                case 'x': {
                    // Swap colors - handled by EditorContext but needs dispatch
                    // We'll let the keyboard event bubble to the toolbox
                    break
                }
                case 'd': {
                    // Reset colors - similarly
                    break
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <ThemeProvider>
            <EditorProvider>
                <div className="app">
                    <Header onToolSelect={setActiveTool} />
                    <ToolOptionsBar activeTool={activeTool} toolOptions={toolOptions} onToolOptionChange={updateToolOption} />
                    <div className="main-content">
                        <Toolbox activeTool={activeTool} onToolSelect={setActiveTool} />
                        <Canvas
                            onCursorMove={setCursorPos}
                            activeTool={activeTool}
                            onToolChange={setActiveTool}
                            toolOptions={toolOptions}
                        />
                        <RightPanel />
                    </div>
                    <StatusBar cursorPos={cursorPos} />
                </div>
            </EditorProvider>
        </ThemeProvider>
    )
}
