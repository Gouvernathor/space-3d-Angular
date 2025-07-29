import * as glm from "gl-matrix";
import RNG, { type MersenneTwister } from "@gouvernathor/rng"
import * as webgl from "./webgl";
import loadProgram from "./loadProgram";

import nebulaGlsl from "./glsl/nebula.glsl";
import pointStarsGlsl from "./glsl/point-stars.glsl";
import starGlsl from "./glsl/star.glsl";
import sunGlsl from "./glsl/sun.glsl";

const NSTARS = 100_000;

export default class Space3D {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private pNebula: webgl.Program;
    private pPointStars: webgl.Program;
    private pStar: webgl.Program;
    private pSun: webgl.Program;
    private rPointStars: webgl.Renderable;
    private rNebula: webgl.Renderable;
    private rStar: webgl.Renderable;
    private rSun: webgl.Renderable;

    constructor() {
        // Offscreen rendering canvas
        this.canvas = document.createElement("canvas");

        // gl context
        this.gl = this.canvas.getContext("webgl")!;
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFuncSeparate(
            this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA,
            this.gl.ZERO, this.gl.ONE,
        );

        // Programs
        this.pNebula = loadProgram(this.gl, nebulaGlsl);
        this.pPointStars = loadProgram(this.gl, pointStarsGlsl);
        this.pStar = loadProgram(this.gl, starGlsl);
        this.pSun = loadProgram(this.gl, sunGlsl);

        // point stars renderable
        const rand = new RNG.MT();
        const position = new Float32Array(NSTARS * 18);
        const color = new Float32Array(NSTARS * 18);
        const starSize = .05;
        for (let i = 0; i < NSTARS; i++) {
            const pos = glm.vec3.random(glm.vec3.create(), 1);
            const star = buildStar(starSize, pos, 128, rand);
            position.set(star.position, i*18);
            color.set(star.color, i*18);
        }
        const attribs = webgl.buildAttribs(this.gl, { aPosition: 3, aColor: 3 });
        attribs["aPosition"].buffer.set(position);
        attribs["aColor"].buffer.set(color);
        const count = position.length / 9;
        this.rPointStars = new webgl.Renderable(
            this.gl, this.pPointStars, attribs, count);

        // other renderables
        this.rNebula = buildBox(this.gl, this.pNebula);
        this.rStar = buildBox(this.gl, this.pStar);
        this.rSun = buildBox(this.gl, this.pSun);
    }
}

function buildStar(
    size: number, pos: glm.ReadonlyVec3, dist: number,
    rand: MersenneTwister,
) {
    const c = rand.random() ** 4;
    const color = Array<number>(18).fill(c);

    const vertices: [number, number, number][] = [
        [-size, -size, 0],
        [ size, -size, 0],
        [ size,  size, 0],
        [-size, -size, 0],
        [ size,  size, 0],
        [-size,  size, 0],
    ];

    const position = [];

    for (const v of vertices) {
        const rot = quadRotFromForward(pos);
        glm.vec3.transformQuat(v, v, rot);
        v[0] += pos[0] * dist;
        v[1] += pos[1] * dist;
        v[2] += pos[2] * dist;
        position.push(...v);
    }

    return {
        position,
        color,
    };
}

function buildBox(gl: WebGLRenderingContext, program: webgl.Program) {
    var position = [
        -1, -1, -1,  1, -1, -1,  1,  1, -1, -1, -1, -1,  1,  1, -1, -1,  1, -1,
         1, -1,  1, -1, -1,  1, -1,  1,  1,  1, -1,  1, -1,  1,  1,  1,  1,  1,
         1, -1, -1,  1, -1,  1,  1,  1,  1,  1, -1, -1,  1,  1,  1,  1,  1, -1,
        -1, -1,  1, -1, -1, -1, -1,  1, -1, -1, -1,  1, -1,  1, -1, -1,  1,  1,
        -1,  1, -1,  1,  1, -1,  1,  1,  1, -1,  1, -1,  1,  1,  1, -1,  1,  1,
        -1, -1,  1,  1, -1,  1,  1, -1, -1, -1, -1,  1,  1, -1, -1, -1, -1, -1,
    ];
    var attribs = webgl.buildAttribs(gl, { aPosition: 3 });
    attribs.aPosition.buffer.set(new Float32Array(position));
    var count = position.length / 9;
    var renderable = new webgl.Renderable(gl, program, attribs, count);
    return renderable;
}

function quadRotBetweenVecs(a: glm.ReadonlyVec3, b: glm.ReadonlyVec3) {
    const theta = Math.acos(glm.vec3.dot(a, b));
    const omega = glm.vec3.create();
    glm.vec3.cross(omega, a, b);
    glm.vec3.normalize(omega, omega);
    const rot = glm.quat.create();
    glm.quat.setAxisAngle(rot, omega, theta);
    return rot;
}

function quadRotFromForward(forward: glm.ReadonlyVec3) {
    return quadRotBetweenVecs(glm.vec3.fromValues(0, 0, -1), forward);
}
