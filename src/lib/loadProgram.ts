import * as webgl from "./webgl";

import noise4d from "./glsl/classic-noise-4d.snip";

export default function loadProgram(
    gl: WebGLRenderingContext,
    source: string,
) {
    const [source0, source1] = source
        .replace("__noise4d__", noise4d)
        .split("__split__");
    return new webgl.Program(gl, source0, source1);
}
