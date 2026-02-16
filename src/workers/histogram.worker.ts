
// histogram.worker.ts

/* eslint-disable no-restricted-globals */

export interface HistogramData {
    r: number[]
    g: number[]
    b: number[]
    lum: number[]
}

self.onmessage = (e: MessageEvent) => {
    const { pixels } = e.data

    if (!pixels) {
        return
    }

    const r = new Array(256).fill(0)
    const g = new Array(256).fill(0)
    const b = new Array(256).fill(0)
    const lum = new Array(256).fill(0)

    // Pixels are [R, G, B, A, R, G, B, A, ...]
    for (let i = 0; i < pixels.length; i += 4) {
        const red = pixels[i]
        const green = pixels[i + 1]
        const blue = pixels[i + 2]
        // const alpha = pixels[i + 3] // Ignore alpha for now, or maybe skip transparent pixels?

        // If strictly keeping to "visible" pixels, we might skip alpha=0
        // But for standard histogram often we just count RGB values. 
        // Let's count them all for now, maybe weight by alpha later if requested.

        r[red]++
        g[green]++
        b[blue]++

        // Luminance (Rec. 709)
        // 0.2126 R + 0.7152 G + 0.0722 B
        const luminance = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue)
        lum[luminance]++
    }

    const result: HistogramData = { r, g, b, lum }
    self.postMessage(result)
}
