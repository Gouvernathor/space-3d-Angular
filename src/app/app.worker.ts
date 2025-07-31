/// <reference lib="webworker" />

addEventListener("message", ({ data: { command, ...data } }) => {
    if (command === "renderSpace") {
        postMessage("renderSpace not implemented");
    } else if (command === "renderSkybox") {
        postMessage("renderSkybox not implemented");
    } else if (command === "setSkyboxTextures") {
        postMessage("setSkyboxTextures not implemented");
    } else {
        postMessage(`Unknown command: ${command}`);
    }
});
