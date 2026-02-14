
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
    text: string
    visible: boolean
    targetRect: DOMRect | null
    offset?: number
}

export default function Tooltip({ text, visible, targetRect, offset = 10 }: TooltipProps) {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

    // We update position when visible or targetRect changes
    useEffect(() => {
        if (!visible || !targetRect) return

        // Calculate position: right side of the unexpected element
        // For toolbox, we want it to the right of the button
        const top = targetRect.top + (targetRect.height / 2)
        const left = targetRect.right + offset

        setPosition({ top, left })
    }, [visible, targetRect, offset])

    if (!visible || !position) return null

    // Use a portal to render outside of the parent container to avoid stacking context clipping
    return createPortal(
        <div
            className="custom-tooltip"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            {text}
        </div>,
        document.body
    )
}
