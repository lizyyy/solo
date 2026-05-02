export const shaders = {
    gradient: `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = pos.xy / uniforms.resolution;
    return vec4f(uv.x, uv.y, 0.5 + 0.5 * sin(uniforms.time), 1.0);
}
`,

    wave: `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = pos.xy / uniforms.resolution;
    let wave = sin(uv.x * 10.0 + uniforms.time) * 0.5 + 0.5;
    let color = vec3f(0.2 + 0.8 * wave, 0.3 + 0.4 * (1.0 - wave), 0.8);
    return vec4f(color, 1.0);
}
`,

    fractal: `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = (pos.xy - uniforms.resolution * 0.5) / min(uniforms.resolution.x, uniforms.resolution.y);
    var z = vec2f(0.0, 0.0);
    var i: f32 = 0.0;
    for (var j: i32 = 0; j < 100; j++) {
        z = vec2f(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uv;
        if (dot(z, z) > 4.0) {
            i = f32(j);
            break;
        }
    }
    let color = vec3f(i / 100.0, i / 50.0, i / 25.0);
    return vec4f(color, 1.0);
}
`,

    pixelate: `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let pixelSize = 10.0;
    let uv = floor(pos.xy / pixelSize) * pixelSize / uniforms.resolution;
    let color = vec3f(uv.x, uv.y, 0.5 + 0.5 * sin(uniforms.time * 2.0));
    return vec4f(color, 1.0);
}
`,

    custom: `
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = pos.xy / uniforms.resolution;
    let color = vec3f(uv.x, uv.y, 1.0 - uv.x - uv.y);
    return vec4f(color, 1.0);
}
`
};

export function getShaderSource(name) {
    return shaders[name] || shaders.custom;
}
