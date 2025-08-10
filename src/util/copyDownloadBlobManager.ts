const urlFinalizer = globalThis.FinalizationRegistry ?
    new FinalizationRegistry((url: string) => URL.revokeObjectURL(url)) :
    { register: () => {}, unregister: () => {} };

export default class BlobManager {
    private url: string = "";
    public releaseDownloadUrl() {
        if (this.url) {
            URL.revokeObjectURL(this.url);
            urlFinalizer.unregister(this);
            this.url = "";
        }
    }

    public async downloadBlob(blob: Blob, filename: string) {
        const a = document.createElement("a");
        a.download = filename;
        this.releaseDownloadUrl();
        a.href = this.url = URL.createObjectURL(blob);
        urlFinalizer.register(this, this.url, this);
        a.click();
    }

    public async copyBlobs(...blobs: Blob[]) {
        const clips = blobs
            .filter(blob => !ClipboardItem.supports || ClipboardItem.supports(blob.type))
            .map(blob => new ClipboardItem({ [blob.type]: blob }));

        if (clips.length > 0) {
            try {
                await navigator.clipboard.write(clips);
            } catch (error) {
                console.error("Failed to copy blobs to clipboard:", error);
            }
        } else {
            console.error("No supported blobs to copy");
        }
    }
}
