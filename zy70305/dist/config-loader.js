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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class ConfigLoader {
    constructor(baseDir = process.cwd()) {
        this.baseDir = baseDir;
    }
    loadCliConfig(configPath) {
        const anomalies = [];
        const fullPath = this.resolvePath(configPath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`配置文件不存在: ${fullPath}`);
        }
        let rawConfig;
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            rawConfig = this.parseFile(content, fullPath);
        }
        catch (error) {
            throw new Error(`配置文件解析失败: ${error.message}`);
        }
        const config = this.validateAndTransformCliConfig(rawConfig, fullPath, anomalies);
        return { config, anomalies };
    }
    loadExemptions(exemptionsPath) {
        const anomalies = [];
        const fullPath = this.resolvePath(exemptionsPath);
        if (!fs.existsSync(fullPath)) {
            return { exemptions: [], anomalies };
        }
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const raw = this.parseFile(content, fullPath);
            const exemptions = this.validateExemptions(raw, fullPath, anomalies);
            return { exemptions, anomalies };
        }
        catch (error) {
            anomalies.push({
                type: 'invalid_exemption',
                message: `豁免文件解析失败: ${error.message}`,
                source: fullPath
            });
            return { exemptions: [], anomalies };
        }
    }
    loadConfirmations(confirmationsPath) {
        const anomalies = [];
        const fullPath = this.resolvePath(confirmationsPath);
        if (!fs.existsSync(fullPath)) {
            return { confirmations: [], anomalies };
        }
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const raw = this.parseFile(content, fullPath);
            const confirmations = this.validateConfirmations(raw, fullPath, anomalies);
            return { confirmations, anomalies };
        }
        catch (error) {
            anomalies.push({
                type: 'invalid_confirmation',
                message: `确认文件解析失败: ${error.message}`,
                source: fullPath
            });
            return { confirmations: [], anomalies };
        }
    }
    saveConfirmations(confirmationsPath, confirmations) {
        const fullPath = this.resolvePath(confirmationsPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const content = yaml.dump({ confirmations }, { indent: 2, lineWidth: -1 });
        fs.writeFileSync(fullPath, content, 'utf-8');
    }
    saveExemptions(exemptionsPath, exemptions) {
        const fullPath = this.resolvePath(exemptionsPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const content = yaml.dump({ exemptions }, { indent: 2, lineWidth: -1 });
        fs.writeFileSync(fullPath, content, 'utf-8');
    }
    resolvePath(filePath) {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.resolve(this.baseDir, filePath);
    }
    parseFile(content, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return JSON.parse(content);
        }
        return yaml.load(content);
    }
    validateAndTransformCliConfig(raw, source, anomalies) {
        if (!raw || typeof raw !== 'object') {
            throw new Error('配置文件格式无效');
        }
        const services = [];
        const ownerMap = new Map();
        if (raw.serviceOwners && Array.isArray(raw.serviceOwners)) {
            for (const owner of raw.serviceOwners) {
                if (owner.serviceName && Array.isArray(owner.owners)) {
                    ownerMap.set(owner.serviceName, owner.owners);
                }
            }
        }
        if (!raw.services || !Array.isArray(raw.services)) {
            throw new Error('配置文件缺少 services 数组');
        }
        for (const rawService of raw.services) {
            if (!rawService.serviceName || !rawService.oldContractPath || !rawService.newContractPath) {
                anomalies.push({
                    type: 'invalid_contract',
                    serviceName: rawService.serviceName,
                    message: `服务配置不完整，缺少必要字段: ${JSON.stringify(rawService)}`,
                    source
                });
                continue;
            }
            let owners = rawService.owners;
            if (!owners || owners.length === 0) {
                owners = ownerMap.get(rawService.serviceName) || [];
            }
            if (!owners || owners.length === 0) {
                anomalies.push({
                    type: 'owner_conflict',
                    serviceName: rawService.serviceName,
                    message: `服务 ${rawService.serviceName} 未配置负责人`,
                    source
                });
            }
            services.push({
                serviceName: rawService.serviceName,
                oldContractPath: this.resolvePath(rawService.oldContractPath),
                newContractPath: this.resolvePath(rawService.newContractPath),
                samplesPath: rawService.samplesPath ? this.resolvePath(rawService.samplesPath) : undefined,
                owners
            });
        }
        return {
            services,
            exemptionsPath: raw.exemptionsPath ? this.resolvePath(raw.exemptionsPath) : undefined,
            confirmationsPath: raw.confirmationsPath ? this.resolvePath(raw.confirmationsPath) : undefined,
            outputDir: raw.outputDir ? this.resolvePath(raw.outputDir) : path.resolve(this.baseDir, 'reports')
        };
    }
    validateExemptions(raw, source, anomalies) {
        const exemptions = [];
        if (!raw || !raw.exemptions) {
            return exemptions;
        }
        if (!Array.isArray(raw.exemptions)) {
            anomalies.push({
                type: 'invalid_exemption',
                message: 'exemptions 字段必须是数组',
                source
            });
            return exemptions;
        }
        for (const ex of raw.exemptions) {
            if (!ex.id || !ex.serviceName || !ex.path || !ex.method || !ex.reason || !ex.expiresAt || !ex.createdBy) {
                anomalies.push({
                    type: 'invalid_exemption',
                    serviceName: ex.serviceName,
                    message: `豁免记录缺少必要字段: ${JSON.stringify(ex)}`,
                    source
                });
                continue;
            }
            const now = new Date();
            const expiresAt = new Date(ex.expiresAt);
            if (expiresAt < now) {
                anomalies.push({
                    type: 'invalid_exemption',
                    serviceName: ex.serviceName,
                    path: ex.path,
                    message: `豁免已过期: ${ex.id}, 过期时间: ${ex.expiresAt}`,
                    source
                });
                continue;
            }
            exemptions.push({
                id: ex.id,
                serviceName: ex.serviceName,
                path: ex.path,
                method: ex.method,
                field: ex.field,
                changeType: ex.changeType,
                reason: ex.reason,
                expiresAt: ex.expiresAt,
                createdBy: ex.createdBy,
                createdAt: ex.createdAt || new Date().toISOString()
            });
        }
        return exemptions;
    }
    validateConfirmations(raw, source, anomalies) {
        const confirmations = [];
        if (!raw || !raw.confirmations) {
            return confirmations;
        }
        if (!Array.isArray(raw.confirmations)) {
            anomalies.push({
                type: 'invalid_confirmation',
                message: 'confirmations 字段必须是数组',
                source
            });
            return confirmations;
        }
        for (const conf of raw.confirmations) {
            if (!conf.diffId || !conf.serviceName || !conf.path || !conf.method || !conf.changeType || !conf.confirmedBy) {
                anomalies.push({
                    type: 'invalid_confirmation',
                    serviceName: conf.serviceName,
                    message: `确认记录缺少必要字段: ${JSON.stringify(conf)}`,
                    source
                });
                continue;
            }
            confirmations.push({
                id: conf.id,
                diffId: conf.diffId,
                serviceName: conf.serviceName,
                path: conf.path,
                method: conf.method,
                changeType: conf.changeType,
                field: conf.field,
                confirmedBy: conf.confirmedBy,
                confirmedAt: conf.confirmedAt || new Date().toISOString(),
                notes: conf.notes,
                changeHash: conf.changeHash
            });
        }
        return confirmations;
    }
}
exports.ConfigLoader = ConfigLoader;
//# sourceMappingURL=config-loader.js.map