import { useState } from 'react'
import { ThemeProvider } from './components/ThemeContext'
import Header from './components/Header'
import ToolOptionsBar from './components/ToolOptionsBar'
import Toolbox from './components/Toolbox'
import Canvas from './components/Canvas'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

export default function App() {
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

    return (
        <ThemeProvider>
            <div className="app">
                <Header />
                <ToolOptionsBar />
                <div className="main-content">
                    <Toolbox />
                    <Canvas onCursorMove={setCursorPos} />
                    <RightPanel />
                </div>
                <StatusBar cursorPos={cursorPos} />
            </div>
        </ThemeProvider>
    )
}
