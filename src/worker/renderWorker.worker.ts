/// <reference lib="webworker" />

import { SideName, sideNames } from "../lib/constants";
import Skybox from "../lib/skybox";
import Space3D from "../lib/space3d";

let renderCanvas: OffscreenCanvas;
const space = new Space3D();
let skybox: Skybox;
let canvasses: { [K in SideName]: OffscreenCanvas };

addEventListener("message", ({ data: { command, ...data } }) => {
    switch (command) {
        case "init": {
            if (skybox || canvasses) {
                throw new Error("Worker already initialized");
            }

            const { renderCanvas: receivedCanvas, canvasses: receivedCanvasses } = data;
            if (!(receivedCanvas instanceof OffscreenCanvas)) {
                throw new Error("Expected renderCanvas to be an OffscreenCanvas");
            }

            renderCanvas = receivedCanvas;
            skybox = new Skybox(renderCanvas);
            canvasses = receivedCanvasses;

            postMessage("initialized"); // debugging only
        } break;


        case "actuateRenderCanvasSize": {
            const { id, clientWidth, clientHeight } = data;

            renderCanvas.width = clientWidth;
            renderCanvas.height = clientHeight;

            postMessage({ id, message: "actuateRenderCanvasSize completed" });
        } break;


        case "renderTextures": {
            // render space
            const { id, params } = data;
            const textures = space.render(params);

            const transferableArray: Transferable[] = [];
            for (const canvas of Object.values(textures)) {
                transferableArray.push(canvas);
            }

            // set skybox textures
            skybox.setTextures(textures);

            // render the sides
            for (const side of sideNames) {
                const target = canvasses[side];
                target.width = target.height = params.resolution;
                const ctx = target.getContext("2d")!;
                ctx.drawImage(textures[side], 0, 0);
            }

            postMessage({ id, message: "renderTextures completed" });
        } break;


        case "renderSkybox": {
            const { id, view, projection } = data;
            skybox.render(view, projection);

            postMessage({ id, message: "renderSkybox completed" });
        } break;


        default: {
            postMessage(`Unknown command: ${command}`);
        } break;
    }
});
