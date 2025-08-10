import { Canvas } from "../lib/constants";

const blobMimes = [ "image/webp", "image/png" ];

export async function getBlobFromCanvas(canvas: Canvas): Promise<[Blob, string]> {
    const result = (await Promise.allSettled(blobMimes.map(mime =>
        canvas instanceof HTMLCanvasElement ?
            fromHTMLCanvas(canvas, mime) :
            fromOffscreenCanvas(canvas, mime)
    ))).filter(result => result.status === "fulfilled")[0];

    if (!result) {
        throw new Error("No supported blob format found");
    }

    const blob = result.value;
    return [blob, (blob.type.split("/")[1])];
}

function fromHTMLCanvas(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
    return new Promise<Blob>((resolve) =>
        canvas.toBlob(blob => {
            if (blob === null) {
                throw new Error(`Failed to extract data as ${mimeType}`);
            }
            resolve(blob);
        }, mimeType, 1.)
    );
}

function fromOffscreenCanvas(canvas: OffscreenCanvas, mimeType: string): Promise<Blob> {
    return canvas.convertToBlob({ type: mimeType, quality: 1. });
}
