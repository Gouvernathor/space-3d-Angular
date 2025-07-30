import * as glm from "gl-matrix";
import RNG, { type MersenneTwister } from "@gouvernathor/rng"
import { SideName, sideNames } from "./constants";
import loadProgram from "./loadProgram";
import * as webgl from "./webgl";

import nebulaGlsl from "./glsl/nebula.glsl";
import pointStarsGlsl from "./glsl/point-stars.glsl";
import starGlsl from "./glsl/star.glsl";
import sunGlsl from "./glsl/sun.glsl";

const NSTARS = 100_000;

type RenderParams = {
    resolution: number;
    seed: number|string;

    pointStars: boolean;
    stars: boolean;
    nebulae: boolean;
    sun: boolean;
};

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

    public render(params: RenderParams) {
        // return value
        const textures: Record<SideName, HTMLCanvasElement> = {} as any;

        // Changes to resolution
        this.canvas.width = this.canvas.height = params.resolution;
        this.gl.viewport(0, 0, params.resolution, params.resolution);

        // random
        const rand = new RNG.MT(params.seed);
        const pointStarSeed = rand.randRange(0xffffffff);
        const starSeed = rand.randRange(0xffffffff);
        const nebulaSeed = rand.randRange(0xffffffff);
        const sunSeed = rand.randRange(0xffffffff);

        // point star parameters
        rand.seed = pointStarSeed;
        type PStarParams = { rotation: glm.ReadonlyMat4 };
        const pStarParams: PStarParams[] = [];
        if (params.pointStars) {
            do {
                pStarParams.push({
                    rotation: randomRotation(rand),
                });
            } while (rand.random() < 0.2);
        }

        // star parameters
        rand.seed = starSeed;
        type StarParams = {
            pos: glm.ReadonlyVec3,
            color: glm.ReadonlyVec3,
            size: number,
            falloff: number,
        };
        const starParams: StarParams[] = [];
        if (params.stars) {
            do {
                starParams.push({
                    pos: randomVec3(rand),
                    color: [1, 1, 1],
                    size: 0,
                    falloff: rand.uniform(2**20, 2**21),
                });
            } while (rand.random() < 0.01);
        }

        // nebula parameters
        rand.seed = nebulaSeed;
        type NebulaParams = {
            scale: number,
            color: glm.ReadonlyVec3,
            intensity: number,
            falloff: number,
            offset: glm.ReadonlyVec3,
        };
        const nebulaParams: NebulaParams[] = [];
        if (params.nebulae) {
            do {
                nebulaParams.push({
                    scale: rand.uniform(0.25, 0.75),
                    color: [rand.random(), rand.random(), rand.random()],
                    intensity: rand.uniform(0.9, 1.1),
                    falloff: rand.uniform(3, 6),
                    offset: [
                        rand.uniform(-1000, 1000),
                        rand.uniform(-1000, 1000),
                        rand.uniform(-1000, 1000),
                    ],
                });
            } while (rand.random() < 0.5);
        }

        // sun parameters
        rand.seed = sunSeed;
        type SunParams = {
            pos: glm.ReadonlyVec3,
            color: glm.ReadonlyVec3,
            size: number,
            falloff: number,
        };
        const sunParams: SunParams[] = [];
        if (params.sun) {
            sunParams.push({
                pos: randomVec3(rand),
                color: [rand.random(), rand.random(), rand.random()],
                size: rand.uniform(.0001, .0002),
                falloff: rand.uniform(8, 24),
            });
        }

        // directions to interate over
        type Dir = {
            target: glm.ReadonlyVec3,
            up: glm.ReadonlyVec3,
        };
        const dirs: Record<SideName, Dir> = {
            front: {
                target: [0, 0, -1],
                up: [0, 1, 0],
            },
            back: {
                target: [0, 0, 1],
                up: [0, 1, 0],
            },
            left: {
                target: [-1, 0, 0],
                up: [0, 1, 0],
            },
            right: {
                target: [1, 0, 0],
                up: [0, 1, 0],
            },
            top: {
                target: [0, 1, 0],
                up: [0, 0, 1],
            },
            bottom: {
                target: [0, -1, 0],
                up: [0, 0, -1],
            },
        };

        // model, view, and projection matrices
        const model = glm.mat4.create();
        const view = glm.mat4.create();
        const projection = glm.mat4.create();
        glm.mat4.perspective(projection, Math.PI / 2, 1, .1, 256);

        // iterate over the directions to render the tectures
        for (const side of sideNames) {
            // clear the context
            this.gl.clearColor(0, 0, 0, 1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);

            // look in the direction of the side
            const dir = dirs[side];
            glm.mat4.lookAt(view, [0, 0, 0], dir.target, dir.up);

            // render point stars
            this.pPointStars.use();
            let model = glm.mat4.create();
            this.pPointStars.setUniform("uView", "Matrix4fv", false, view);
            this.pPointStars.setUniform("uProjection", "Matrix4fv", false, projection);
            for (const ps of pStarParams) {
                glm.mat4.mul(model, ps.rotation, model);
                this.pPointStars.setUniform("uModel", "Matrix4fv", false, model);
                this.rPointStars.render();
            }

            // render stars
            this.pStar.use();
            this.pStar.setUniform("uView", "Matrix4fv", false, view);
            this.pStar.setUniform("uProjection", "Matrix4fv", false, projection);
            this.pStar.setUniform("uModel", "Matrix4fv", false, model);
            for (const s of starParams) {
                this.pStar.setUniform("uPosition", "3fv", s.pos);
                this.pStar.setUniform("uColor", "3fv", s.color);
                this.pStar.setUniform("uSize", "1f", s.size);
                this.pStar.setUniform("uFalloff", "1f", s.falloff);
                this.rStar.render();
            }

            // render nebulae
            this.pNebula.use();
            model = glm.mat4.create();
            for (const p of nebulaParams) {
                this.pNebula.setUniform("uModel", "Matrix4fv", false, model);
                this.pNebula.setUniform("uView", "Matrix4fv", false, view);
                this.pNebula.setUniform("uProjection", "Matrix4fv", false, projection);
                this.pNebula.setUniform("uScale", "1f", p.scale);
                this.pNebula.setUniform("uColor", "3fv", p.color);
                this.pNebula.setUniform("uIntensity", "1f", p.intensity);
                this.pNebula.setUniform("uFalloff", "1f", p.falloff);
                this.pNebula.setUniform("uOffset", "3fv", p.offset);
                this.rNebula.render();
            }

            // render sun
            this.pSun.use();
            this.pSun.setUniform("uView", "Matrix4fv", false, view);
            this.pSun.setUniform("uProjection", "Matrix4fv", false, projection);
            this.pSun.setUniform("uModel", "Matrix4fv", false, model);
            for (const sun of sunParams) {
                this.pSun.setUniform("uPosition", "3fv", sun.pos);
                this.pSun.setUniform("uColor", "3fv", sun.color);
                this.pSun.setUniform("uSize", "1f", sun.size);
                this.pSun.setUniform("uFalloff", "1f", sun.falloff);
                this.rSun.render();
            }

            // create the texture
            const c = document.createElement("canvas");
            c.width = c.height = params.resolution;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(this.canvas, 0, 0);
            textures[side] = c;
        }

        return textures;
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

function randomRotation(rand: MersenneTwister) {
    const rot = glm.mat4.create();
    glm.mat4.rotateX(rot, rot, rand.random() * Math.PI * 2);
    glm.mat4.rotateY(rot, rot, rand.random() * Math.PI * 2);
    glm.mat4.rotateZ(rot, rot, rand.random() * Math.PI * 2);
    return rot;
}

function randomVec3(rand: MersenneTwister) {
    const v = [0, 0, 1] as [number, number, number];
    const rot = randomRotation(rand);
    glm.vec3.transformMat4(v, v, rot);
    glm.vec3.normalize(v, v);
    return v;
}
