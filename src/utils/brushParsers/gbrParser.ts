
export interface GbrHeader {
    size: number;
    version: number;
    width: number;
    height: number;
    bytesPerPixel: number; // 1 (grayscale) or 4 (rgba)
    magic: string;
    spacing: number;
    name: string;
}

export interface GbrData {
    header: GbrHeader;
    bitmap: Uint8Array;
}

export const parseGbr = (buffer: ArrayBuffer): GbrData => {
    const view = new DataView(buffer);
    let offset = 0;

    // Header size (Total size of header including this field)
    const headerSize = view.getUint32(offset, false); // Big endian
    offset += 4;

    // Version
    const version = view.getUint32(offset, false);
    offset += 4;

    if (version !== 2) {
        throw new Error(`Unsupported GBR version: ${version}`);
    }

    // Width
    const width = view.getUint32(offset, false);
    offset += 4;

    // Height
    const height = view.getUint32(offset, false);
    offset += 4;

    // Bytes per pixel
    const bytesPerPixel = view.getUint32(offset, false);
    offset += 4;

    // Magic number
    const magic = view.getUint32(offset, false);
    offset += 4;

    // Spacing
    const spacing = view.getUint32(offset, false);
    offset += 4;

    // Name (null-terminated string)
    let name = '';
    // Reading name until null char or end of header
    while (offset < headerSize) {
        const charCode = view.getUint8(offset);
        offset++;
        if (charCode === 0) break;
        name += String.fromCharCode(charCode);
    }

    // Pixel data starts exactly at headerSize
    const pixelOffset = headerSize;
    const pixelDataSize = width * height * bytesPerPixel;

    if (pixelOffset + pixelDataSize > buffer.byteLength) {
        console.warn('GBR Parser: Buffer end reached before expected pixel data end. Truncated?');
    }

    const bitmap = new Uint8Array(buffer, pixelOffset, pixelDataSize);

    return {
        header: {
            size: headerSize,
            version,
            width,
            height,
            bytesPerPixel,
            magic: magic.toString(16),
            spacing,
            name
        },
        bitmap
    };
};
