import { Canvas } from "./constants";

class GLBuffer {
    private readonly buffer: WebGLBuffer|null = null;

    constructor(private readonly gl: WebGLRenderingContext) {
        this.buffer = this.gl.createBuffer();
    }

    public bind() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }

    public set(data: Float32Array) { // type assumed from usage, may be extended
        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    }
};

interface ProgramAttrib {
    name: string;
    location: number;
    type: number;
    size: number;
}
interface ProgramUniform {
    name: string;
    location: WebGLUniformLocation|null;
    type: number;
    size: number;
}

export class Program {
    private readonly program: WebGLProgram;
    public readonly attribs: { readonly [K: string]: ProgramAttrib };
    private readonly uniforms: { readonly [K: string]: ProgramUniform };

    constructor(
        private readonly gl: WebGLRenderingContext,
        vertexShaderSource: string,
        fragmentShaderSource: string,
    ) {
        this.program = this.compileProgram(vertexShaderSource, fragmentShaderSource);
        this.attribs = this.gatherAttribs();
        this.uniforms = this.gatherUniforms();
    }

    public use() {
        this.gl.useProgram(this.program);
    }

    private compileProgram(vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram {
        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        const program = this.gl.createProgram()!;
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error(`Program link error: ${this.gl.getProgramInfoLog(program)}`);
        }
        return program;
    }

    private compileShader(source: string, type: number): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const err = this.gl.getShaderInfoLog(shader)!;
            const lineno = parseInt(err.split(":")[2]);
            const split = source.split("\n");
            for (let i = 0; i < split.length; i++) {
                console.log(`${i} ${split[i]}`);
                if (i === lineno - 1) {
                    console.warn(err);
                }
            }
            const typeString = type === this.gl.VERTEX_SHADER ? "vertex" : "fragment";
            throw new Error(`Failed to compile ${typeString} shader.`);
        }
        return shader;
    }

    private gatherAttribs() {
        const attribs: Record<string, ProgramAttrib> = {};
        const nAttribs = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < nAttribs; i++) {
            const attrib = this.gl.getActiveAttrib(this.program, i)!;
            attribs[attrib.name] = {
                name: attrib.name,
                location: this.gl.getAttribLocation(this.program, attrib.name),
                type: attrib.type,
                size: attrib.size,
            };
        }
        return attribs;
    }

    private gatherUniforms() {
        const uniforms: Record<string, ProgramUniform> = {};
        const nUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nUniforms; i++) {
            const uniform = this.gl.getActiveUniform(this.program, i)!;
            uniforms[uniform.name] = {
                name: uniform.name,
                location: this.gl.getUniformLocation(this.program, uniform.name),
                type: uniform.type,
                size: uniform.size,
            };
        }
        return uniforms;
    }

    public setUniform(name: string, fn: (gl: WebGLRenderingContext, loc: WebGLUniformLocation|null) => void) {
        this.use();
        let location: WebGLUniformLocation|null;
        try {
            location = this.uniforms[name].location;
        } catch (e) {
            console.error(`Failed to get location for uniform named ${name}`);
            throw e;
        }
        fn(this.gl, location);
    }
}

type Attrib = { buffer: GLBuffer; size: number };

export function buildAttribs<K extends string>(
    gl: WebGLRenderingContext,
    layout: { [P in K]: number },
) {
    const attribs: { [P in K]: Attrib } = {} as any;
    for (const key in layout) {
        attribs[key] = {
            buffer: new GLBuffer(gl),
            size: layout[key],
        };
    }
    return attribs;
}

export class Renderable {
    constructor(
        private readonly gl: WebGLRenderingContext,
        private readonly program: Program,
        private readonly attribs: Record<string, Attrib>,
        private readonly primitiveCount: number,
    ) {}

    public render() {
        this.program.use();
        for (const name in this.attribs) {
            const buffer = this.attribs[name].buffer;
            const size = this.attribs[name].size;
            let location;
            try {
                location = this.program.attribs[name].location;
            } catch (e) {
                console.error(`Failed to get location for attribute ${name}`);
                throw e;
            }
            buffer.bind();
            this.gl.enableVertexAttribArray(location);
            this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, 0, 0);
        }
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3 * this.primitiveCount);
        for (const name in this.attribs) {
            this.gl.disableVertexAttribArray(this.program.attribs[name].location);
        }
    }
}

function defaultTextureOptions(gl: WebGLRenderingContext, {
    target = gl.TEXTURE_2D,
    mag = gl.NEAREST,
    min = gl.NEAREST,
    wraps = gl.CLAMP_TO_EDGE,
    wrapt = gl.CLAMP_TO_EDGE,
    internalFormat = gl.RGBA,
    format = gl.RGBA,
    type = gl.UNSIGNED_BYTE,
} = {}) {
    return { target, mag, min, wraps, wrapt, internalFormat, format, type };
}
export class Texture {
    private readonly texture: WebGLTexture;
    private readonly options: ReturnType<typeof defaultTextureOptions>;

    constructor(
        private readonly gl: WebGLRenderingContext,
        private readonly index: number,
        private readonly data: Canvas,
        private readonly width: number,
        private readonly height: number,
        options = {},
    ) {
        this.options = defaultTextureOptions(gl, options);
        this.activate();
        this.texture = gl.createTexture()!;
        this.bind();
        gl.texImage2D(
            this.options.target, 0, this.options.internalFormat,
            this.options.format, this.options.type, this.data);
        gl.texParameteri(this.options.target, gl.TEXTURE_MAG_FILTER, this.options.mag);
        gl.texParameteri(this.options.target, gl.TEXTURE_MIN_FILTER, this.options.min);
        gl.texParameteri(this.options.target, gl.TEXTURE_WRAP_S, this.options.wraps);
        gl.texParameteri(this.options.target, gl.TEXTURE_WRAP_T, this.options.wrapt);
        if (this.options.mag !== gl.NEAREST || this.options.min !== gl.NEAREST) {
            gl.generateMipmap(this.options.target);
        }
    }

    public bind() {
        this.gl.bindTexture(this.options.target, this.texture);
    }

    private activate() {
        this.gl.activeTexture(this.gl.TEXTURE0 + this.index);
    }

    private reset() {
        this.activate();
        this.bind();
        this.gl.texImage2D(
            this.options.target, 0, this.options.internalFormat,
            this.width, this.height, 0,
            this.options.format, this.options.type, this.data as any); // TODO check
    }
}
