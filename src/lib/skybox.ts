import * as glm from "gl-matrix";
import { SideName } from "./constants";
import loadProgram from "./loadProgram";
import * as webgl from "./webgl";

import skyboxGlsl from "./glsl/skybox.glsl";

export default class Skybox {
    private gl: WebGLRenderingContext;
    private pSkybox: webgl.Program;
    private rSkybox: webgl.Renderable;
    private textures: Record<SideName, webgl.Texture>|null = null;

    constructor(
        private renderCanvas: HTMLCanvasElement,
    ) {
        this.gl = renderCanvas.getContext("webgl")!;
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.pSkybox = loadProgram(this.gl, skyboxGlsl);
        this.rSkybox = buildQuad(this.gl, this.pSkybox);
    }

    public setTextures(canvases: Record<SideName, HTMLCanvasElement>) {
        const textures = {} as Record<SideName, webgl.Texture>;
        for (const [key, canvas] of Object.entries(canvases)) {
            textures[key as SideName] = new webgl.Texture(this.gl, 0, canvas, canvas.width, canvas.height, {
                min: this.gl.LINEAR_MIPMAP_LINEAR,
                mag: this.gl.LINEAR,
            });
        }
        this.textures = textures;
    }

    public render(view: Float32List, projection: Float32List) {
        this.gl.viewport(0, 0, this.renderCanvas.width, this.renderCanvas.height);

        const model = glm.mat4.create();

        this.pSkybox.use();
        this.pSkybox.setUniform("uView", "Matrix4fv", false, view);
        this.pSkybox.setUniform("uProjection", "Matrix4fv", false, projection);

        this.textures!.front.bind();
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();

        this.textures!.back.bind();
        glm.mat4.rotateY(model, glm.mat4.create(), Math.PI);
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();

        this.textures!.left.bind();
        glm.mat4.rotateY(model, glm.mat4.create(), Math.PI / 2);
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();

        this.textures!.right.bind();
        glm.mat4.rotateY(model, glm.mat4.create(), -Math.PI / 2);
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();

        this.textures!.top.bind();
        glm.mat4.rotateX(model, glm.mat4.create(), Math.PI / 2);
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();

        this.textures!.bottom.bind();
        glm.mat4.rotateX(model, glm.mat4.create(), -Math.PI / 2);
        this.pSkybox.setUniform("uModel", "Matrix4fv", false, model);
        this.rSkybox.render();
    }
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
    attribs.aPosition.buffer.set(new Float32Array(position));
    attribs.aUV.buffer.set(new Float32Array(uv));
    const count = position.length / 9;
    const renderable = new webgl.Renderable(gl, program, attribs, count);
    return renderable;
}
