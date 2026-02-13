export default function StatusBar() {
    return (
        <footer className="status-bar">
            <div className="status-group">
                <span className="status-text">Cursor Position x:810</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y:518</span>
            </div>
            <div className="status-group">
                <span className="status-text">Width: 1920px</span>
                <span className="status-text" style={{ marginLeft: 26 }}>Height: 1080px</span>
            </div>
            <div className="status-group">
                <span className="status-text">Position Change x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Starting Position x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Angle x: ---</span>
                <span className="status-text" style={{ marginLeft: 26 }}>y: ---</span>
            </div>
            <div className="status-group">
                <span className="status-text">Color Profile: GNU RGB</span>
            </div>
            <div className="status-spacer" />
            <div className="status-group" style={{ marginRight: 40 }}>
                <span className="status-text">8 bits per channel</span>
            </div>
            <div className="status-group" style={{ marginRight: 0 }}>
                <span className="status-text">1920 x 1080 72 dpi</span>
            </div>
        </footer>
    )
}
