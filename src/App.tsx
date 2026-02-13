import Header from './components/Header'
import ToolOptionsBar from './components/ToolOptionsBar'
import Toolbox from './components/Toolbox'
import Canvas from './components/Canvas'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

export default function App() {
    return (
        <div className="app">
            <Header />
            <ToolOptionsBar />
            <div className="main-content">
                <Toolbox />
                <Canvas />
                <RightPanel />
            </div>
            <StatusBar />
        </div>
    )
}
