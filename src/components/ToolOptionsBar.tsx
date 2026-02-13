import { useState } from 'react'
import {
    ChevronDown,
    FlipVertical,
    Layers,
    FlipHorizontal,
    CheckSquare,
    Square,
} from 'lucide-react'

function Checkbox({
    checked: initialChecked,
    label,
}: {
    checked: boolean
    label: string
}) {
    const [checked, setChecked] = useState(initialChecked)
    return (
        <div
            className="tool-options-checkbox"
            onClick={() => setChecked(!checked)}
        >
            <div className={`checkbox-box ${checked ? 'checked' : 'unchecked'}`}>
                {checked ? <CheckSquare size={16} /> : <Square size={16} />}
            </div>
            <span>{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={() => { }}
                style={{ display: 'none' }}
            />
        </div>
    )
}

export default function ToolOptionsBar() {
    return (
        <div className="tool-options">
            {/* Mode group */}
            <div className="tool-options-group">
                <span className="tool-options-label">Mode</span>
                <div className="tool-options-icon-btn"><FlipVertical size={16} /></div>
                <div className="tool-options-icon-btn"><Square size={16} /></div>
                <div className="tool-options-icon-btn"><Layers size={16} /></div>
                <div className="tool-options-icon-btn"><FlipHorizontal size={16} /></div>
            </div>

            <div className="tool-options-divider" />

            {/* Checkboxes */}
            <Checkbox checked={true} label="Antialiasing" />
            <Checkbox checked={false} label="Feather edges" />
            <Checkbox checked={true} label="Select transparent areas" />
            <Checkbox checked={false} label="Sample merged" />
            <Checkbox checked={false} label="Diagonal neighbors" />

            <div className="tool-options-divider" />

            {/* Threshold slider */}
            <div className="tool-options-slider-group">
                <span className="slider-label">Threshold</span>
                <input
                    type="range"
                    className="tool-options-slider"
                    min={0}
                    max={255}
                    defaultValue={15}
                />
                <div className="tool-options-dropdown" style={{ width: 61 }}>
                    <span>15.0</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            <div className="tool-options-divider" />

            {/* Select by */}
            <div className="tool-options-group">
                <span className="tool-options-label">Select by</span>
                <div className="tool-options-dropdown" style={{ width: 94 }}>
                    <span>Composite</span>
                    <ChevronDown size={16} />
                </div>
            </div>

            <Checkbox checked={false} label="Draw mask" />
        </div>
    )
}
