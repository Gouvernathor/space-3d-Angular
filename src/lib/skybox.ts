import loadProgram from "./loadProgram";
import * as webgl from "./webgl";

import skyboxGlsl from "./glsl/skybox.glsl";

export default class Skybox {
    private gl: WebGLRenderingContext;
    private pSkybox: webgl.Program;
    private rSkybox: webgl.Renderable;
    private textures: { [key: string]: unknown };

    constructor(
        private renderCanvas: HTMLCanvasElement,
    ) {
        this.gl = renderCanvas.getContext("webgl")!;
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.pSkybox = loadProgram(this.gl, skyboxGlsl);
        this.rSkybox = buildQuad(this.gl, this.pSkybox);
        this.textures = {};
    }

    public setTextures(canvases: Record<string, HTMLCanvasElement>) {
        this.textures = {};
        for (const [key, canvas] of Object.entries(canvases)) {
            this.textures[key] = new webgl.Texture(this.gl, 0, canvas, canvas.width, canvas.height, {
                min: this.gl.LINEAR_MIPMAP_LINEAR,
                mag: this.gl.LINEAR,
            });
        }
    }

    // render
}

function buildQuad(gl: WebGLRenderingContext, program: webgl.Program) {
    const position = [
        -1, -1, -1,
         1, -1, -1,
         1,  1, -1,
        -1, -1, -1,
         1,  1, -1,
        -1,  1, -1,
    ];
    const uv = [
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1
    ];
    const attribs = webgl.buildAttribs(gl, { aPosition: 3, aUV: 2 });
    attribs["aPosition"].buffer.set(new Float32Array(position));
    attribs["aUV"].buffer.set(new Float32Array(uv));
    const count = position.length / 9;
    const renderable = new webgl.Renderable(gl, program, attribs, count);
    return renderable;
}
