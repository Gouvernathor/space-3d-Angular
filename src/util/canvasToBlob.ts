const blobMimes = [ "image/webp", "image/png" ];

export async function getBlobFromCanvas(canvas: HTMLCanvasElement): Promise<[Blob, string]> {
    const result = (await Promise.allSettled(blobMimes.map(mime =>
        new Promise<Blob>((resolve) =>
            canvas.toBlob(blob => {
                if (blob === null) {
                    throw new Error(`Failed to extract data as ${mime}`);
                }
                resolve(blob);
            }, mime, 1.)
        )
    ))).filter(result => result.status === "fulfilled")[0];

    if (!result) {
        throw new Error("No supported blob format found");
    }

    const blob = result.value;
    return [blob, (blob.type.split("/")[1])];
}
