import { useEffect, useState } from 'react'
import { ThemeProvider } from './components/ThemeContext'
import { EditorProvider } from './components/EditorContext'
import Header from './components/Header'
import ToolOptionsBar from './components/ToolOptionsBar'
import Toolbox from './components/Toolbox'
import Canvas from './components/Canvas'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

export default function App() {
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
    const [activeTool, setActiveTool] = useState<string>('move')

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }

            switch (e.key.toLowerCase()) {
                case 'c':
                    setActiveTool('crop')
                    break
                case 'v':
                    setActiveTool('move')
                    break
                // Add more shortcuts here
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <ThemeProvider>
            <EditorProvider>
                <div className="app">
                    <Header />
                    <ToolOptionsBar />
                    <div className="main-content">
                        <Toolbox activeTool={activeTool} onToolSelect={setActiveTool} />
                        <Canvas onCursorMove={setCursorPos} activeTool={activeTool} />
                        <RightPanel />
                    </div>
                    <StatusBar cursorPos={cursorPos} />
                </div>
            </EditorProvider>
        </ThemeProvider>
    )
}
