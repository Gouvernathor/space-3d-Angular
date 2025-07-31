import { SideName, sideNames } from "./lib/constants";
import Skybox from "./lib/skybox";
import Space3D from "./lib/space3d";

export interface RenderWorkManager {
    renderTextures(...p: Parameters<typeof Space3D.prototype.render>): Promise<void>|void;
    readonly renderSkybox: typeof Skybox.prototype.render;
}
export function newWorkerManager(
    renderCanvas: HTMLCanvasElement,
    canvasses: { readonly [K in SideName]: HTMLCanvasElement },
): RenderWorkManager {
    if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('./app/app.worker', import.meta.url));

        { // Initialize the worker
            const transferableArray: Transferable[] = [];
            const offscreen = renderCanvas.transferControlToOffscreen();
            transferableArray.push(offscreen);
            const offscreenCanvasses: { [K in SideName]: OffscreenCanvas } = {} as any;
            for (const side of sideNames) {
                offscreenCanvasses[side] = canvasses[side].transferControlToOffscreen();
                transferableArray.push(offscreenCanvasses[side]);
            }

            worker.postMessage({ command: "init",
                renderCanvas: offscreen, canvasses: offscreenCanvasses
            }, transferableArray);
        }

        worker.addEventListener("message", ({ data }) => {
            if (data.message) {
                data = data.message;
            }
            console.debug(`page got message (from worker): ${data}`);
        });
        return {
            renderTextures: (params) => {
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

                // No transferable objects in this case
                worker.postMessage({ command: "renderTextures", id, params }, []);

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
            // renderSpace: space.render.bind(space),
            // setSkyboxTextures: skybox.setTextures.bind(skybox),
            renderTextures: (params) => {
                const textures = space.render(params);
                skybox.setTextures(textures);

                for (const side of sideNames) {
                    const target = canvasses[side];
                    target.width = target.height = params.resolution;
                    const ctx = target.getContext("2d")!;
                    ctx.drawImage(textures[side], 0, 0);
                }
            },
            renderSkybox: skybox.render.bind(skybox),
        };
    }
}
