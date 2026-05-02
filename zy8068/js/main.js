import { shaders, getShaderSource } from './shaders.js';
import { GPUCapabilityDetector, getDetector } from './capabilities.js';
import { WebGPURenderer, WebGLFallback, CanvasFallback } from './renderer.js';

class ShaderLab {
    constructor() {
        this.detector = null;
        this.renderer = null;
        this.fallback = null;
        this.currentMode = 'webgpu';
        this.traces = [];
        this.frameTimeHistory = [];

        this.initElements();
        this.init();
    }

    initElements() {
        this.webgpuStatus = document.getElementById('webgpuStatus');
        this.webglStatus = document.getElementById('webglStatus');
        this.adapterStatus = document.getElementById('adapterStatus');
        this.adapterName = document.getElementById('adapterName');
        this.fallbackNotice = document.getElementById('fallbackNotice');
        this.fallbackReason = document.getElementById('fallbackReason');
        this.shaderSelect = document.getElementById('shaderSelect');
        this.shaderEditor = document.getElementById('shaderEditor');
        this.runBtn = document.getElementById('runBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.compileCheckBtn = document.getElementById('compileCheckBtn');
        this.errorBox = document.getElementById('errorBox');
        this.capabilityGrid = document.getElementById('capabilityGrid');
        this.renderCanvas = document.getElementById('renderCanvas');
        this.timingCanvas = document.getElementById('timingCanvas');
        this.traceLog = document.getElementById('traceLog');
        this.exportPreview = document.getElementById('exportPreview');
        this.exportReportBtn = document.getElementById('exportReportBtn');
        this.exportTracesBtn = document.getElementById('exportTracesBtn');
        this.clearTracesBtn = document.getElementById('clearTracesBtn');
    }

    async init() {
        this.addTrace('初始化着色器实验室', 'info');

        this.detector = getDetector();
        await this.detector.detect();

        this.updateStatusUI();
        this.renderCapabilities();

        if (this.detector.webgpuSupported) {
            this.currentMode = 'webgpu';
            try {
                this.renderer = new WebGPURenderer(this.renderCanvas);
                await this.renderer.init(this.detector.device);
                this.addTrace('WebGPU 渲染器初始化成功', 'success');
            } catch (e) {
                this.addTrace(`WebGPU 初始化失败: ${e.message}`, 'error');
                this.enableFallback('webgl');
            }
        } else if (this.detector.webglSupported) {
            this.enableFallback('webgl');
        } else {
            this.enableFallback('canvas');
        }

        this.shaderSelect.addEventListener('change', () => this.onShaderChange());
        this.runBtn.addEventListener('click', () => this.runShader());
        this.resetBtn.addEventListener('click', () => this.resetShader());
        this.compileCheckBtn.addEventListener('click', () => this.compileCheck());
        this.exportReportBtn.addEventListener('click', () => this.exportReport());
        this.exportTracesBtn.addEventListener('click', () => this.exportTraces());
        this.clearTracesBtn.addEventListener('click', () => this.clearTraces());

        window.addEventListener('resize', () => this.onResize());

        this.onShaderChange();
    }

    enableFallback(mode) {
        this.currentMode = mode;
        this.addTrace(`启用 ${mode === 'webgl' ? 'WebGL' : 'Canvas 2D'} 降级模式`, 'warning');

        this.fallbackReason.textContent = this.detector.fallbackReason;
        this.fallbackNotice.classList.add('visible');

        if (mode === 'webgl') {
            try {
                this.fallback = new WebGLFallback(this.renderCanvas);
                this.fallback.init();
                this.addTrace('WebGL 降级渲染器初始化成功', 'success');
            } catch (e) {
                this.addTrace(`WebGL 初始化失败: ${e.message}`, 'error');
                this.enableFallback('canvas');
                return;
            }
        } else {
            this.fallback = new CanvasFallback(this.renderCanvas);
            this.fallback.init();
            this.addTrace('Canvas 2D 降级渲染器初始化成功', 'success');
        }

        if (this.fallback) {
            this.fallback.onFrameTime = (times) => this.onFrameTime(times);
            this.fallback.start();
        }
    }

    updateStatusUI() {
        if (this.detector.webgpuSupported) {
            this.webgpuStatus.className = 'status-dot success';
            this.adapterStatus.className = 'status-dot success';
            if (this.detector.adapterInfo.vendor) {
                this.adapterName.textContent = `${this.detector.adapterInfo.vendor} ${this.detector.adapterInfo.architecture || ''}`.trim();
            }
        } else {
            this.webgpuStatus.className = 'status-dot error';
            this.adapterStatus.className = 'status-dot warning';
            this.adapterName.textContent = '无 GPU 适配器';
        }

        if (this.detector.webglSupported) {
            this.webglStatus.className = 'status-dot success';
        } else {
            this.webglStatus.className = 'status-dot warning';
        }
    }

    renderCapabilities() {
        const caps = this.detector.getCapabilities();
        this.capabilityGrid.innerHTML = caps.map(cap => `
            <div class="capability-item">
                <div class="capability-label">${cap.label}</div>
                <div class="capability-value" style="color: ${cap.status === 'error' ? '#f87171' : cap.status === 'success' ? '#4ade80' : cap.status === 'warning' ? '#fbbf24' : '#eee'}">${cap.value}</div>
            </div>
        `).join('');
    }

    onShaderChange() {
        const shaderName = this.shaderSelect.value;
        if (shaderName !== 'custom') {
            this.shaderEditor.value = getShaderSource(shaderName);
        }
    }

    resetShader() {
        const shaderName = this.shaderSelect.value;
        if (shaderName !== 'custom') {
            this.shaderEditor.value = getShaderSource(shaderName);
        }
        this.hideError();
    }

    async compileCheck() {
        this.addTrace('执行编译检查', 'info');
        this.hideError();

        const source = this.shaderEditor.value;

        if (this.currentMode === 'webgpu' && this.renderer) {
            try {
                await this.renderer.createPipeline(source);
                this.addTrace('编译检查通过', 'success');
                this.showSuccess('✓ 编译成功');
            } catch (e) {
                if (e.type === 'compilation') {
                    this.showCompilationErrors(e.errors);
                    this.addTrace(`编译错误: ${e.errors.length} 个`, 'error');
                } else {
                    this.showCompilationErrors([{ message: e.message }]);
                    this.addTrace(`编译错误: ${e.message}`, 'error');
                }
            }
        } else if (this.fallback) {
            try {
                this.fallback.compileShader(source);
                this.addTrace('编译检查通过 (WebGL)', 'success');
                this.showSuccess('✓ 编译成功 (WebGL)');
            } catch (e) {
                this.showCompilationErrors(e.errors || [{ message: e.message }]);
                this.addTrace(`编译错误: ${e.message}`, 'error');
            }
        }
    }

    async runShader() {
        this.addTrace('运行着色器', 'info');
        this.hideError();

        const source = this.shaderEditor.value;

        if (this.currentMode === 'webgpu' && this.renderer) {
            try {
                await this.renderer.createPipeline(source);
                this.renderer.stop();
                this.renderer.start();
                this.renderer.onFrameTime = (times) => this.onFrameTime(times);
                this.addTrace('WebGPU 渲染开始', 'success');
            } catch (e) {
                if (e.type === 'compilation') {
                    this.showCompilationErrors(e.errors);
                    this.addTrace(`编译错误: ${e.errors.length} 个`, 'error');
                } else {
                    this.showCompilationErrors([{ message: e.message }]);
                    this.addTrace(`运行错误: ${e.message}`, 'error');
                }
            }
        } else if (this.fallback) {
            try {
                this.fallback.compileShader(source);
                this.fallback.stop();
                this.fallback.start();
                this.fallback.onFrameTime = (times) => this.onFrameTime(times);
                this.addTrace('降级渲染开始', 'success');
            } catch (e) {
                this.showCompilationErrors(e.errors || [{ message: e.message }]);
                this.addTrace(`运行错误: ${e.message}`, 'error');
            }
        }
    }

    showCompilationErrors(errors) {
        this.errorBox.innerHTML = errors.map(err =>
            `<div class="error-line">${err.line ? `行 ${err.line}: ` : ''}${err.message}</div>`
        ).join('');
        this.errorBox.classList.add('visible');
    }

    showSuccess(message) {
        this.errorBox.innerHTML = `<div class="error-line" style="color: #4ade80;">${message}</div>`;
        this.errorBox.classList.add('visible');
        setTimeout(() => this.hideError(), 2000);
    }

    hideError() {
        this.errorBox.classList.remove('visible');
    }

    onFrameTime(times) {
        this.frameTimeHistory = times;
        this.drawTimingChart();
    }

    drawTimingChart() {
        const canvas = this.timingCanvas;
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth * window.devicePixelRatio;
        const h = canvas.clientHeight * window.devicePixelRatio;
        canvas.width = w;
        canvas.height = h;

        ctx.fillStyle = '#0f1629';
        ctx.fillRect(0, 0, w, h);

        if (this.frameTimeHistory.length < 2) return;

        const max = Math.max(...this.frameTimeHistory, 100);
        const min = 0;
        const range = max - min || 1;

        ctx.beginPath();
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;

        this.frameTimeHistory.forEach((time, i) => {
            const x = (i / (this.frameTimeHistory.length - 1)) * w;
            const y = h - ((time - min) / range) * h;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(`当前: ${this.frameTimeHistory[this.frameTimeHistory.length - 1]?.toFixed(1) || 0}ms`, 5, 15);
        ctx.fillText(`平均: ${(this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length).toFixed(1)}ms`, 5, 28);
    }

    onResize() {
        if (this.renderer) {
            this.renderer.resize();
        } else if (this.fallback) {
            this.fallback.resize();
        }
        this.drawTimingChart();
    }

    exportReport() {
        const report = this.detector.generateCompatibilityReport();
        this.exportPreview.textContent = report;

        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compatibility_report.md';
        a.click();
        URL.revokeObjectURL(url);

        this.addTrace('兼容性报告已导出', 'success');
    }

    exportTraces() {
        const traces = {
            timestamp: new Date().toISOString(),
            traces: Array.from(this.traceLog.children).map(item => item.textContent),
            frameTimes: this.frameTimeHistory
        };

        const json = JSON.stringify(traces, null, 2);
        this.exportPreview.textContent = json;

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'traces.json';
        a.click();
        URL.revokeObjectURL(url);

        this.addTrace('追踪数据已导出', 'success');
    }

    clearTraces() {
        this.traceLog.innerHTML = '';
        this.addTrace('追踪日志已清空', 'info');
    }

    addTrace(message, type = 'info') {
        const timestamp = new Date().toISOString().substr(11, 12);
        const traceItem = document.createElement('div');
        traceItem.className = 'trace-item';
        traceItem.innerHTML = `<span class="trace-timestamp">[${timestamp}]</span>${message}`;
        traceItem.style.borderLeftColor = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#667eea';
        this.traceLog.appendChild(traceItem);
        this.traceLog.scrollTop = this.traceLog.scrollHeight;

        this.traces.push({ timestamp, message, type });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new ShaderLab();
});
