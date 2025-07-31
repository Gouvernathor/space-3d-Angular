import Skybox from "./lib/skybox";
import Space3D from "./lib/space3d";

export interface RenderWorkManager {
    readonly renderSpace: (...p: Parameters<typeof Space3D.prototype.render>) => Promise<ReturnType<typeof Space3D.prototype.render>>|ReturnType<typeof Space3D.prototype.render>;
    readonly setSkyboxTextures: (...p: Parameters<typeof Skybox.prototype.setTextures>) => Promise<ReturnType<typeof Skybox.prototype.setTextures>>|ReturnType<typeof Skybox.prototype.setTextures>;
    readonly renderSkybox: typeof Skybox.prototype.render;
}
export function newWorkerManager(renderCanvas: HTMLCanvasElement): RenderWorkManager {
    // skybox setTextures render
    // space render
    if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('./app/app.worker', import.meta.url));
        const offscreen = renderCanvas.transferControlToOffscreen();
        worker.postMessage({ command: "init", renderCanvas: offscreen }, [offscreen]);

        worker.addEventListener('message', ({ data }) => {
            if (data.message) {
                data = data.message;
            }
            console.debug(`page got message (from worker): ${data}`);
        });
        return {
            renderSpace: (params) => {
                // To avoid mixups between different render calls, we use a unique ID
                const id = crypto.randomUUID();

                // Prepare reception of the response
                const prom = new Promise<ReturnType<typeof Space3D.prototype.render>>((resolve) => {
                    const listener = ({ data: { id: receivedId, return: canvasses } }: MessageEvent) => {
                        if (receivedId === id) {
                            worker.removeEventListener('message', listener);
                            resolve(canvasses);
                        }
                    };
                    worker.addEventListener("message", listener);
                });

                // No transferable objects in this case
                worker.postMessage({ command: 'renderSpace', id, params }, []);

                // Now wait for the response
                return prom;
            },
            setSkyboxTextures: (canvases) => {
                // To avoid mixups between different render calls, we use a unique ID
                const id = crypto.randomUUID();

                // Prepare reception of the response
                const prom = new Promise<void>((resolve) => {
                    const listener = ({ data: { id: receivedId } }: MessageEvent) => {
                        if (receivedId === id) {
                            worker.removeEventListener("message", listener);
                            resolve();
                        }
                    };
                    worker.addEventListener("message", listener);
                });

                const transferableArray: Transferable[] = [];
                for (const canvas of Object.values(canvases)) {
                    if (canvas instanceof HTMLCanvasElement) {
                        const offscreen = canvas.transferControlToOffscreen();
                        transferableArray.push(offscreen);
                    } else {
                        transferableArray.push(canvas);
                    }
                }
                worker.postMessage({ command: 'setSkyboxTextures', id, canvases }, transferableArray);

                // Now wait for the response
                return prom;
            },
            renderSkybox: (view, projection) => {
                const transferableArray: Transferable[] = [];
                for (const list of [view, projection]) {
                    if (list instanceof Float32Array) {
                        if (list.buffer instanceof ArrayBuffer) {
                            transferableArray.push(list.buffer);
                        }
                    }
                }
                worker.postMessage({ command: 'renderSkybox', view, projection }, transferableArray);
            },
        };
    } else {
        // Web Workers are not supported in this environment.
        // You should add a fallback so that your program still executes correctly.
        const space = new Space3D();
        const skybox = new Skybox(renderCanvas);
        return {
            renderSpace: space.render.bind(space),
            setSkyboxTextures: skybox.setTextures.bind(skybox),
            renderSkybox: skybox.render.bind(skybox),
        };
    }
}
