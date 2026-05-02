export class WebGPURenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.pipeline = null;
        this.uniformBuffer = null;
        this.uniformBindGroup = null;
        this.animationId = null;
        this.startTime = 0;
        this.frameTimes = [];
        this.maxFrameTimes = 60;
        this.lastFrameTime = 0;
        this.onFrameTime = null;
    }

    async init(device) {
        this.device = device;
        this.context = this.canvas.getContext('webgpu');

        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'opaque'
        });

        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;

        this.uniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    async compileShader(source) {
        const shaderModule = this.device.createShaderModule({ code: source });

        const compilationInfo = await shaderModule.getCompilationInfo();

        if (compilationInfo.messages.length > 0) {
            const errors = compilationInfo.messages
                .filter(msg => msg.type === 'error')
                .map(msg => ({
                    line: msg.lineNum,
                    column: msg.linePos,
                    message: msg.message
                }));

            if (errors.length > 0) {
                throw { type: 'compilation', errors };
            }
        }

        return shaderModule;
    }

    async createPipeline(shaderSource) {
        const shaderModule = await this.compileShader(shaderSource);

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'main'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'main',
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer
                }
            }]
        });

        return this.pipeline;
    }

    updateUniforms(mouseX = 0, mouseY = 0) {
        const uniforms = new Float32Array([
            this.canvas.width,
            this.canvas.height,
            (Date.now() - this.startTime) / 1000,
            mouseX,
            mouseY
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }

    render(mouseX = 0, mouseY = 0) {
        const currentTime = performance.now();
        if (this.lastFrameTime > 0) {
            const frameTime = currentTime - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            if (this.frameTimes.length > this.maxFrameTimes) {
                this.frameTimes.shift();
            }
            if (this.onFrameTime) {
                this.onFrameTime(this.frameTimes);
            }
        }
        this.lastFrameTime = currentTime;

        this.updateUniforms(mouseX, mouseY);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.uniformBindGroup);
        renderPass.draw(3);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    start(mouseX = 0, mouseY = 0) {
        this.startTime = Date.now();
        this.lastFrameTime = 0;

        const loop = () => {
            this.render(mouseX, mouseY);
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resize() {
        if (this.context) {
            this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
            this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        }
    }

    getFrameTimes() {
        return this.frameTimes;
    }
}

export class WebGLFallback {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.animationId = null;
        this.startTime = 0;
        this.frameTimes = [];
        this.maxFrameTimes = 60;
        this.lastFrameTime = 0;
        this.onFrameTime = null;
    }

    init() {
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            throw new Error('WebGL 不可用');
        }

        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    compileShader(source) {
        const gl = this.gl;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(vertexShader);
            gl.deleteShader(vertexShader);
            throw { type: 'compilation', errors: [{ message: error }] };
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        const wgslToGLSL = this.convertWGSLToGLSL(source);
        gl.shaderSource(fragmentShader, wgslToGLSL);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(fragmentShader);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw { type: 'compilation', errors: [{ message: error }] };
        }

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(this.program);
            gl.deleteProgram(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteProgram(this.program);
            throw { type: 'linking', errors: [{ message: error }] };
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        return this.program;
    }

    convertWGSLToGLSL(wgslSource) {
        let glsl = wgslSource
            .replace(/@group\(\d+\)\s+@binding\(\d+\)/g, '')
            .replace(/@builtin\([^)]+\)/g, '')
            .replace(/@location\(\d+\)/g, '')
            .replace(/struct\s+\w+\s*\{[^}]*\}/g, '')
            .replace(/var<uniform>/g, 'uniform')
            .replace(/var</g, '')
            .replace(/f32/g, 'float')
            .replace(/vec2f/g, 'vec2')
            .replace(/vec3f/g, 'vec3')
            .replace(/vec4f/g, 'vec4')
            .replace(/i32/g, 'int')
            .replace(/u32/g, 'uint')
            .replace(/f64/g, 'double')
            .replace(/bool/g, 'bool')
            .replace(/matrix<[^>]+>/g, (match) => {
                const dim = match.match(/matrix<(\w+), (\d+), (\d+)>/);
                if (dim) {
                    const type = dim[1];
                    const cols = dim[2];
                    const rows = dim[3];
                    if (type === 'f32') {
                        return `mat${cols}x${rows}`;
                    }
                }
                return match;
            });

        const hasMain = /void\s+main\s*\(/.test(glsl);
        if (!hasMain) {
            glsl = glsl.replace(
                /void\s+main\s*\[[^\]]*\]\s*\(\s*\)/,
                'void main()'
            );
        }

        glsl = glsl.replace(/@fragment/g, '');
        glsl = glsl.replace(/@vertex/g, '');
        glsl = glsl.replace(/#\s*\w+/g, '');

        return glsl;
    }

    render(time = 0, mouseX = 0, mouseY = 0) {
        const gl = this.gl;

        const currentTime = performance.now();
        if (this.lastFrameTime > 0) {
            const frameTime = currentTime - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            if (this.frameTimes.length > this.maxFrameTimes) {
                this.frameTimes.shift();
            }
            if (this.onFrameTime) {
                this.onFrameTime(this.frameTimes);
            }
        }
        this.lastFrameTime = currentTime;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        const resolutionLoc = gl.getUniformLocation(this.program, 'resolution');
        if (resolutionLoc) {
            gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);
        }

        const timeLoc = gl.getUniformLocation(this.program, 'time');
        if (timeLoc) {
            gl.uniform1f(timeLoc, (Date.now() - this.startTime) / 1000);
        }

        const mouseLoc = gl.getUniformLocation(this.program, 'mouse');
        if (mouseLoc) {
            gl.uniform2f(mouseLoc, mouseX, mouseY);
        }

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);

        const positionLoc = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.deleteBuffer(positionBuffer);
    }

    start() {
        this.startTime = Date.now();
        this.lastFrameTime = 0;

        const loop = () => {
            this.render();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resize() {
        if (this.gl) {
            this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
            this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    getFrameTimes() {
        return this.frameTimes;
    }
}

export class CanvasFallback {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationId = null;
        this.startTime = 0;
        this.frameTimes = [];
        this.maxFrameTimes = 60;
        this.lastFrameTime = 0;
        this.onFrameTime = null;
    }

    init() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
    }

    render(time = 0) {
        const currentTime = performance.now();
        if (this.lastFrameTime > 0) {
            const frameTime = currentTime - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            if (this.frameTimes.length > this.maxFrameTimes) {
                this.frameTimes.shift();
            }
            if (this.onFrameTime) {
                this.onFrameTime(this.frameTimes);
            }
        }
        this.lastFrameTime = currentTime;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const t = (Date.now() - this.startTime) / 1000;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, `hsl(${(t * 50) % 360}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${(t * 50 + 60) % 360}, 70%, 50%)`);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(w / 2 + Math.sin(t) * 50, h / 2 + Math.cos(t) * 50, 100, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Canvas 2D 降级模式', w / 2, h / 2 + 150);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#888';
        ctx.fillText('WebGPU 和 WebGL 均不可用', w / 2, h / 2 + 170);
    }

    start() {
        this.startTime = Date.now();
        this.lastFrameTime = 0;

        const loop = () => {
            this.render();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
    }

    getFrameTimes() {
        return this.frameTimes;
    }
}
