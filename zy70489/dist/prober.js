"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prober = void 0;
const dns = __importStar(require("dns"));
const net = __importStar(require("net"));
const axios_1 = __importDefault(require("axios"));
class Prober {
    constructor(db) {
        this.db = db;
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    async probeDNS(host, timeout = 5000) {
        const startTime = Date.now();
        const result = {
            id: this.generateId(),
            dependencyId: 'dns-' + host.replace(/\./g, '-'),
            dependencyName: `DNS-${host}`,
            status: 'success',
            timestamp: Date.now()
        };
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const error = new Error('DNS查询超时');
                    error.code = 'ETIMEDOUT';
                    reject(error);
                }, timeout);
                dns.lookup(host, (err) => {
                    clearTimeout(timer);
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            result.responseTime = Date.now() - startTime;
        }
        catch (error) {
            result.status = 'failure';
            result.errorType = 'dns';
            if (error.code === 'ENOTFOUND') {
                result.errorMessage = `DNS解析失败: 域名 ${host} 不存在`;
            }
            else if (error.code === 'ETIMEDOUT') {
                result.errorMessage = `DNS查询超时: ${host} (${timeout}ms)`;
            }
            else if (error.code === 'ECONNREFUSED') {
                result.errorMessage = `DNS服务器拒绝连接`;
            }
            else {
                result.errorMessage = `DNS异常: ${error.message}`;
            }
            result.responseTime = Date.now() - startTime;
        }
        await this.db.insertProbeResult(result);
        return result;
    }
    async probeTCP(host, port, timeout = 5000) {
        const startTime = Date.now();
        const result = {
            id: this.generateId(),
            dependencyId: `tcp-${host.replace(/\./g, '-')}-${port}`,
            dependencyName: `TCP-${host}:${port}`,
            status: 'success',
            timestamp: Date.now()
        };
        try {
            await new Promise((resolve, reject) => {
                const socket = new net.Socket();
                const timer = setTimeout(() => {
                    socket.destroy();
                    const error = new Error('TCP连接超时');
                    error.code = 'ETIMEDOUT';
                    reject(error);
                }, timeout);
                socket.connect(port, host, () => {
                    clearTimeout(timer);
                    socket.destroy();
                    resolve();
                });
                socket.on('error', (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            });
            result.responseTime = Date.now() - startTime;
        }
        catch (error) {
            result.status = 'failure';
            result.errorType = 'port';
            if (error.code === 'ECONNREFUSED') {
                result.errorMessage = `端口连接被拒绝: ${host}:${port} 服务未监听`;
            }
            else if (error.code === 'ETIMEDOUT') {
                result.errorMessage = `端口连接超时: ${host}:${port} (${timeout}ms)`;
            }
            else if (error.code === 'EHOSTUNREACH') {
                result.errorMessage = `主机不可达: ${host}`;
            }
            else if (error.code === 'ENETUNREACH') {
                result.errorMessage = `网络不可达`;
            }
            else {
                result.errorMessage = `端口异常: ${error.message}`;
            }
            result.responseTime = Date.now() - startTime;
        }
        await this.db.insertProbeResult(result);
        return result;
    }
    async probeHTTP(url, timeout = 5000, expectedStatus = 200) {
        const startTime = Date.now();
        const result = {
            id: this.generateId(),
            dependencyId: 'http-' + url.replace(/[^a-zA-Z0-9]/g, '-'),
            dependencyName: `HTTP-${url}`,
            status: 'success',
            timestamp: Date.now()
        };
        try {
            const response = await axios_1.default.get(url, { timeout, validateStatus: () => true });
            result.responseTime = Date.now() - startTime;
            if (response.status !== expectedStatus) {
                result.status = 'failure';
                result.errorType = 'business';
                result.errorMessage = `业务响应异常: 期望状态码 ${expectedStatus}, 实际 ${response.status}`;
                result.rawData = { status: response.status, data: response.data };
            }
        }
        catch (error) {
            result.status = 'failure';
            result.responseTime = Date.now() - startTime;
            if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                result.errorType = 'dns';
                result.errorMessage = `DNS解析失败: 无法解析域名`;
            }
            else if (error.code === 'ECONNREFUSED') {
                result.errorType = 'port';
                result.errorMessage = `连接被拒绝: 服务未启动或端口未开放`;
            }
            else if (error.code === 'ETIMEDOUT') {
                result.errorType = 'business';
                result.errorMessage = `HTTP请求超时 (${timeout}ms)`;
            }
            else if (error.response) {
                result.errorType = 'business';
                result.errorMessage = `业务响应异常: 状态码 ${error.response.status}`;
                result.rawData = { status: error.response.status, data: error.response.data };
            }
            else {
                result.errorType = 'business';
                result.errorMessage = `HTTP请求异常: ${error.message}`;
            }
        }
        await this.db.insertProbeResult(result);
        return result;
    }
    async probe(config) {
        const timeout = config.timeout || 5000;
        switch (config.type) {
            case 'dns':
                return this.probeDNS(config.host, timeout);
            case 'tcp':
                if (!config.port) {
                    throw new Error('TCP探活需要指定端口');
                }
                return this.probeTCP(config.host, config.port, timeout);
            case 'http':
                const url = `http://${config.host}${config.path || ''}`;
                return this.probeHTTP(url, timeout);
            default:
                throw new Error(`不支持的探活类型: ${config.type}`);
        }
    }
    async probeAll(configs) {
        const results = [];
        for (const config of configs) {
            const result = await this.probe(config);
            results.push(result);
        }
        return results;
    }
}
exports.Prober = Prober;
