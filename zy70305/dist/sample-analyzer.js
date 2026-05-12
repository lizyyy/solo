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
exports.SampleAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class SampleAnalyzer {
    constructor(parser) {
        this.parser = parser;
    }
    analyze(serviceName, samplesPath, oldSpec, newSpec, diffs) {
        const analyses = [];
        const anomalies = [];
        const samples = this.loadSamples(samplesPath, serviceName, anomalies);
        for (const sample of samples) {
            const issues = [];
            const pathInfo = this.resolvePath(serviceName, sample, oldSpec, newSpec, issues);
            if (pathInfo) {
                this.checkDeletedFields(sample, pathInfo, diffs, issues);
                this.checkRemovedEnumValues(sample, pathInfo, diffs, issues);
            }
            analyses.push({ sample, issues });
        }
        return { analyses, anomalies };
    }
    loadSamples(samplesPath, serviceName, anomalies) {
        const samples = [];
        const fullPath = path.isAbsolute(samplesPath) ? samplesPath : path.resolve(process.cwd(), samplesPath);
        if (!fs.existsSync(fullPath)) {
            return samples;
        }
        const stat = fs.statSync(fullPath);
        const files = [];
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(fullPath);
            for (const entry of entries) {
                const entryPath = path.join(fullPath, entry);
                const entryStat = fs.statSync(entryPath);
                if (entryStat.isFile() && (entry.endsWith('.json') || entry.endsWith('.yaml') || entry.endsWith('.yml'))) {
                    files.push(entryPath);
                }
            }
        }
        else {
            files.push(fullPath);
        }
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const data = this.parseFile(content, file);
                if (Array.isArray(data)) {
                    for (let i = 0; i < data.length; i++) {
                        const sample = data[i];
                        if (this.validateSample(sample, serviceName, file, i + 1, anomalies)) {
                            samples.push({
                                ...sample,
                                serviceName: sample.serviceName || serviceName,
                                source: file,
                                lineNumber: i + 1
                            });
                        }
                    }
                }
                else if (data && data.samples && Array.isArray(data.samples)) {
                    for (let i = 0; i < data.samples.length; i++) {
                        const sample = data.samples[i];
                        if (this.validateSample(sample, serviceName, file, i + 1, anomalies)) {
                            samples.push({
                                ...sample,
                                serviceName: sample.serviceName || serviceName,
                                source: file,
                                lineNumber: i + 1
                            });
                        }
                    }
                }
            }
            catch (error) {
                anomalies.push({
                    type: 'invalid_sample',
                    serviceName,
                    message: `样本文件解析失败: ${file} - ${error.message}`,
                    source: file
                });
            }
        }
        return samples;
    }
    validateSample(sample, serviceName, source, lineNumber, anomalies) {
        if (!sample || typeof sample !== 'object') {
            anomalies.push({
                type: 'invalid_sample',
                serviceName,
                message: `无效的样本格式: ${source} #${lineNumber}`,
                source
            });
            return false;
        }
        if (!sample.operationId && !sample.path) {
            anomalies.push({
                type: 'invalid_sample',
                serviceName,
                message: `样本缺少 operationId 或 path: ${source} #${lineNumber}`,
                source
            });
            return false;
        }
        if (sample.path && !sample.method) {
            anomalies.push({
                type: 'invalid_sample',
                serviceName,
                message: `样本指定了 path 但缺少 method: ${source} #${lineNumber}`,
                source
            });
            return false;
        }
        return true;
    }
    parseFile(content, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return JSON.parse(content);
        }
        return yaml.load(content);
    }
    resolvePath(serviceName, sample, oldSpec, newSpec, issues) {
        let pathInfo;
        if (sample.operationId) {
            pathInfo =
                this.parser.getSchemaByOperationId(newSpec, sample.operationId) ||
                    this.parser.getSchemaByOperationId(oldSpec, sample.operationId);
            if (!pathInfo) {
                issues.push({
                    type: 'missing_operation',
                    operationId: sample.operationId,
                    path: sample.path || 'unknown',
                    method: sample.method,
                    description: `找不到接口定义: operationId=${sample.operationId}`
                });
                return null;
            }
        }
        else if (sample.path && sample.method) {
            const method = sample.method.toLowerCase();
            pathInfo =
                this.parser.getSchemaForPath(newSpec, sample.path, method) ||
                    this.parser.getSchemaForPath(oldSpec, sample.path, method);
            if (!pathInfo) {
                issues.push({
                    type: 'missing_operation',
                    path: sample.path,
                    method,
                    description: `找不到接口定义: ${method.toUpperCase()} ${sample.path}`
                });
                return null;
            }
        }
        return pathInfo || null;
    }
    checkDeletedFields(sample, pathInfo, diffs, issues) {
        const deletedFields = diffs.filter(d => d.path === pathInfo.path &&
            d.method === pathInfo.method &&
            (d.changeType === 'response_field_deleted' || d.changeType === 'request_body_field_deleted'));
        if (sample.responseBody) {
            const responseDeletions = deletedFields.filter(d => d.changeType === 'response_field_deleted');
            for (const deletion of responseDeletions) {
                if (deletion.field && this.hasField(sample.responseBody, deletion.field)) {
                    issues.push({
                        type: 'uses_deleted_field',
                        field: deletion.field,
                        path: pathInfo.path,
                        method: pathInfo.method,
                        operationId: pathInfo.operationId,
                        description: `样本使用了已删除的响应字段: ${deletion.field}`
                    });
                }
            }
        }
        if (sample.requestBody) {
            const requestDeletions = deletedFields.filter(d => d.changeType === 'request_body_field_deleted');
            for (const deletion of requestDeletions) {
                if (deletion.field && this.hasField(sample.requestBody, deletion.field)) {
                    issues.push({
                        type: 'uses_deleted_field',
                        field: deletion.field,
                        path: pathInfo.path,
                        method: pathInfo.method,
                        operationId: pathInfo.operationId,
                        description: `样本使用了已删除的请求字段: ${deletion.field}`
                    });
                }
            }
        }
    }
    checkRemovedEnumValues(sample, pathInfo, diffs, issues) {
        const enumChanges = diffs.filter(d => d.path === pathInfo.path &&
            d.method === pathInfo.method &&
            d.changeType === 'enum_value_removed');
        for (const change of enumChanges) {
            if (!change.field || !change.affectedEnumValues)
                continue;
            if (sample.responseBody) {
                const values = this.getFieldValues(sample.responseBody, change.field);
                const usedRemoved = values.filter(v => change.affectedEnumValues.includes(String(v)));
                if (usedRemoved.length > 0) {
                    issues.push({
                        type: 'uses_removed_enum',
                        field: change.field,
                        path: pathInfo.path,
                        method: pathInfo.method,
                        operationId: pathInfo.operationId,
                        description: `样本使用了已移除的枚举值: ${change.field} = [${usedRemoved.join(', ')}]`
                    });
                }
            }
            if (sample.requestBody) {
                const values = this.getFieldValues(sample.requestBody, change.field);
                const usedRemoved = values.filter(v => change.affectedEnumValues.includes(String(v)));
                if (usedRemoved.length > 0) {
                    issues.push({
                        type: 'uses_removed_enum',
                        field: change.field,
                        path: pathInfo.path,
                        method: pathInfo.method,
                        operationId: pathInfo.operationId,
                        description: `样本使用了已移除的枚举值: ${change.field} = [${usedRemoved.join(', ')}]`
                    });
                }
            }
        }
    }
    hasField(obj, fieldPath) {
        const parts = fieldPath.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined)
                return false;
            if (part.endsWith('[]')) {
                const arrayField = part.slice(0, -2);
                if (!Array.isArray(current[arrayField]))
                    return false;
                let found = false;
                for (const item of current[arrayField]) {
                    if (typeof item === 'object') {
                        found = true;
                        break;
                    }
                }
                return found;
            }
            if (typeof current !== 'object')
                return false;
            if (!(part in current))
                return false;
            current = current[part];
        }
        return true;
    }
    getFieldValues(obj, fieldPath) {
        const values = [];
        const parts = fieldPath.split('.');
        this.collectFieldValues(obj, parts, 0, values);
        return values;
    }
    collectFieldValues(obj, parts, index, values) {
        if (obj === null || obj === undefined)
            return;
        if (index >= parts.length) {
            if (obj !== null && obj !== undefined) {
                values.push(String(obj));
            }
            return;
        }
        const part = parts[index];
        if (part.endsWith('[]')) {
            const arrayField = part.slice(0, -2);
            if (Array.isArray(obj[arrayField])) {
                for (const item of obj[arrayField]) {
                    this.collectFieldValues(item, parts, index + 1, values);
                }
            }
            return;
        }
        if (typeof obj === 'object' && part in obj) {
            this.collectFieldValues(obj[part], parts, index + 1, values);
        }
    }
}
exports.SampleAnalyzer = SampleAnalyzer;
//# sourceMappingURL=sample-analyzer.js.map