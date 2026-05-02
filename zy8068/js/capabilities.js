export class GPUCapabilityDetector {
    constructor() {
        this.adapter = null;
        this.device = null;
        this.features = {};
        this.limits = {};
        this.adapterInfo = {};
        this.webgpuSupported = false;
        this.webglSupported = false;
        this.fallbackReason = '';
        this.webgpuError = null;
    }

    async detect() {
        this.addTrace('开始 GPU 能力检测', 'info');

        if (typeof navigator !== 'undefined' && navigator.gpu) {
            this.webgpuSupported = true;
            this.addTrace('WebGPU API 检测成功', 'success');
        } else {
            this.webgpuSupported = false;
            this.webgpuError = '浏览器不支持 WebGPU API';
            this.addTrace('WebGPU API 不可用', 'error');
        }

        try {
            if (this.webgpuSupported) {
                this.adapter = await navigator.gpu.requestAdapter();
                if (!this.adapter) {
                    this.webgpuSupported = false;
                    this.fallbackReason = '无法获取 GPU 适配器 (navigator.gpu.requestAdapter() 返回 null)';
                    this.webgpuError = this.fallbackReason;
                    this.addTrace('无法获取 GPU 适配器', 'error');
                } else {
                    this.addTrace('GPU 适配器获取成功', 'success');
                    this.adapterInfo = await this.adapter.requestAdapterInfo();
                    this.addTrace(`适配器: ${this.adapterInfo.vendor || '未知'}/${this.adapterInfo.architecture || '未知'}`, 'info');
                }
            }
        } catch (e) {
            this.webgpuSupported = false;
            this.fallbackReason = `GPU 适配器请求失败: ${e.message}`;
            this.webgpuError = e.message;
            this.addTrace(`GPU 适配器错误: ${e.message}`, 'error');
        }

        if (this.webgpuSupported) {
            try {
                this.device = await this.adapter.requestDevice();
                this.addTrace('GPU 设备请求成功', 'success');
            } catch (e) {
                this.webgpuSupported = false;
                this.fallbackReason = `GPU 设备请求失败: ${e.message}`;
                this.webgpuError = e.message;
                this.addTrace(`GPU 设备错误: ${e.message}`, 'error');
            }
        }

        if (this.webgpuSupported) {
            this.features = {};
            this.device.features.forEach((value, key) => {
                this.features[key] = value;
            });

            this.limits = {};
            Object.keys(this.device.limits).forEach(key => {
                this.limits[key] = this.device.limits[key];
            });
            this.addTrace('GPU 特性检测完成', 'info');
        }

        this.webglSupported = this.detectWebGL();
        if (!this.webgpuSupported && this.webglSupported) {
            this.fallbackReason = this.fallbackReason || 'WebGPU 不可用，启用 WebGL 降级';
        }

        return {
            webgpuSupported: this.webgpuSupported,
            webglSupported: this.webglSupported,
            adapter: this.adapter,
            device: this.device,
            features: this.features,
            limits: this.limits,
            adapterInfo: this.adapterInfo,
            fallbackReason: this.fallbackReason,
            webgpuError: this.webgpuError
        };
    }

    detectWebGL() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    getCapabilities() {
        const caps = [];

        caps.push({
            label: 'WebGPU 支持',
            value: this.webgpuSupported ? '✓ 支持' : '✗ 不支持',
            status: this.webgpuSupported ? 'success' : 'error'
        });

        caps.push({
            label: 'WebGL 支持',
            value: this.webglSupported ? '✓ 支持' : '✗ 不支持',
            status: this.webglSupported ? 'success' : 'warning'
        });

        if (this.adapterInfo.vendor) {
            caps.push({
                label: 'GPU 厂商',
                value: this.adapterInfo.vendor,
                status: 'info'
            });
        }

        if (this.adapterInfo.architecture) {
            caps.push({
                label: 'GPU 架构',
                value: this.adapterInfo.architecture,
                status: 'info'
            });
        }

        if (this.adapterInfo.device) {
            caps.push({
                label: '设备 ID',
                value: this.adapterInfo.device,
                status: 'info'
            });
        }

        if (this.adapterInfo.description) {
            caps.push({
                label: '设备描述',
                value: this.adapterInfo.description,
                status: 'info'
            });
        }

        if (this.webgpuSupported) {
            caps.push({
                label: '最大纹理尺寸',
                value: this.limits.maxTextureDimension1D || this.limits.maxTextureDimension2D || 'N/A',
                status: 'info'
            });

            caps.push({
                label: '最大绑定组数',
                value: this.limits.maxBindGroups || 'N/A',
                status: 'info'
            });

            caps.push({
                label: '最大Uniform缓冲大小',
                value: this.limits.maxUniformBufferBindingSize || 'N/A',
                status: 'info'
            });

            caps.push({
                label: '着色器版本',
                value: 'WGSL',
                status: 'success'
            });
        }

        if (!this.webgpuSupported && this.fallbackReason) {
            caps.push({
                label: '降级原因',
                value: this.fallbackReason,
                status: 'warning'
            });
        }

        return caps;
    }

    generateCompatibilityReport() {
        const report = [];
        report.push('# WebGPU 兼容性报告');
        report.push('');
        report.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
        report.push('');
        report.push('## 环境信息');
        report.push(`- 用户代理: ${navigator.userAgent}`);
        report.push(`- WebGPU 支持: ${this.webgpuSupported ? '是' : '否'}`);
        report.push(`- WebGL 支持: ${this.webglSupported ? '是' : '否'}`);
        report.push('');

        if (this.adapterInfo.vendor) {
            report.push('## GPU 适配器信息');
            report.push(`- 厂商: ${this.adapterInfo.vendor}`);
            report.push(`- 架构: ${this.adapterInfo.architecture || '未知'}`);
            report.push(`- 设备: ${this.adapterInfo.device || '未知'}`);
            report.push(`- 描述: ${this.adapterInfo.description || '未知'}`);
            report.push('');
        }

        if (this.webgpuSupported) {
            report.push('## GPU 特性');
            if (Object.keys(this.features).length > 0) {
                Object.keys(this.features).forEach(key => {
                    report.push(`- ${key}: ${this.features[key]}`);
                });
            } else {
                report.push('(无特殊特性)');
            }
            report.push('');

            report.push('## GPU 限制');
            Object.keys(this.limits).forEach(key => {
                report.push(`- ${key}: ${this.limits[key]}`);
            });
            report.push('');
        }

        if (!this.webgpuSupported) {
            report.push('## 降级信息');
            report.push(`- 降级原因: ${this.fallbackReason || 'WebGPU 不可用'}`);
            report.push(`- WebGPU 错误: ${this.webgpuError || 'N/A'}`);
            report.push('');
        }

        report.push('## 结论');
        if (this.webgpuSupported) {
            report.push('当前环境支持 WebGPU，可以运行 WGSL 着色器。');
        } else if (this.webglSupported) {
            report.push('当前环境不支持 WebGPU，但支持 WebGL 降级预览。');
        } else {
            report.push('当前环境不支持 WebGPU 和 WebGL，仅支持 Canvas 2D 降级预览。');
        }

        return report.join('\n');
    }

    addTrace(message, type = 'info') {
        if (typeof traceLog !== 'undefined' && traceLog) {
            const timestamp = new Date().toISOString().substr(11, 12);
            const traceItem = document.createElement('div');
            traceItem.className = 'trace-item';
            traceItem.innerHTML = `<span class="trace-timestamp">[${timestamp}]</span>${message}`;
            traceItem.style.borderLeftColor = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#667eea';
            traceLog.appendChild(traceItem);
            traceLog.scrollTop = traceLog.scrollHeight;
        }
    }
}

let detector = null;

export function getDetector() {
    if (!detector) {
        detector = new GPUCapabilityDetector();
    }
    return detector;
}
