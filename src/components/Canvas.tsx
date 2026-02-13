import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const tabs = [
    { name: 'PhimhubRedesign_Final2.xcf', active: false },
    { name: 'PhimhubRedesign_Final1.xcf', active: true },
    { name: 'PhimhubRedesign_Final3.xcf', active: false },
]

function Ruler({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [, setTick] = useState(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !canvas.parentElement) return

        const draw = () => {
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const dpr = window.devicePixelRatio || 1
            const isHorizontal = orientation === 'horizontal'
            const parent = canvas.parentElement!

            if (isHorizontal) {
                canvas.width = parent.clientWidth * dpr
                canvas.height = 16 * dpr
                canvas.style.width = `${parent.clientWidth}px`
                canvas.style.height = '16px'
            } else {
                canvas.width = 16 * dpr
                canvas.height = parent.clientHeight * dpr
                canvas.style.width = '16px'
                canvas.style.height = `${parent.clientHeight}px`
            }

            ctx.scale(dpr, dpr)
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            const size = isHorizontal ? parent.clientWidth : parent.clientHeight

            for (let i = 0; i <= size; i += 10) {
                const isMajor = i % 100 === 0
                const isMedium = i % 50 === 0

                ctx.strokeStyle = isMajor ? '#949494' : '#6e6e6e'
                ctx.lineWidth = 1

                const tickLen = isMajor ? 12 : isMedium ? 8 : 4

                ctx.beginPath()
                if (isHorizontal) {
                    ctx.moveTo(i, 16)
                    ctx.lineTo(i, 16 - tickLen)
                } else {
                    ctx.moveTo(16, i)
                    ctx.lineTo(16 - tickLen, i)
                }
                ctx.stroke()

                if (isMajor && i > 0) {
                    ctx.fillStyle = '#6e6e6e'
                    ctx.font = '8px "JetBrains Mono", monospace'
                    if (isHorizontal) {
                        ctx.fillText(String(i), i + 2, 8)
                    } else {
                        ctx.save()
                        ctx.translate(3, i + 2)
                        ctx.rotate(-Math.PI / 2)
                        ctx.fillText(String(i), 0, 0)
                        ctx.restore()
                    }
                }
            }
        }

        draw()

        const ro = new ResizeObserver(() => {
            draw()
            setTick((t) => t + 1)
        })
        ro.observe(canvas.parentElement)
        return () => ro.disconnect()
    }, [orientation])

    return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

export default function Canvas() {
    return (
        <div className="canvas-area">
            {/* File Tabs */}
            <div className="canvas-tabs">
                {tabs.map((tab) => (
                    <div
                        key={tab.name}
                        className={`canvas-tab ${tab.active ? 'active' : 'inactive'}`}
                    >
                        <span>{tab.name}</span>
                        <div className="tab-close">
                            <X size={10} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Separator */}
            <div className="canvas-separator" />

            {/* Rulers + Canvas viewport */}
            <div className="canvas-with-rulers">
                {/* Corner */}
                <div className="ruler-corner" />

                {/* Horizontal ruler */}
                <div className="ruler-horizontal">
                    <Ruler orientation="horizontal" />
                </div>

                {/* Vertical ruler */}
                <div className="ruler-vertical">
                    <Ruler orientation="vertical" />
                </div>

                {/* Canvas viewport */}
                <div className="canvas-viewport">
                    <img
                        src="/cathedral.jpg"
                        alt="Canvas content"
                        className="canvas-image"
                    />

                    {/* Vertical scrollbar */}
                    <div className="scrollbar-v">
                        <div className="scrollbar-v-thumb" />
                    </div>

                    {/* Horizontal scrollbar */}
                    <div className="scrollbar-h">
                        <div className="scrollbar-h-thumb" />
                    </div>

                    {/* Resize handle */}
                    <div className="canvas-resize-handle" />
                </div>
            </div>
        </div>
    )
}
