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
exports.ConfigComparator = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const diff = __importStar(require("diff"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const json5_1 = __importDefault(require("json5"));
const lodash_1 = __importDefault(require("lodash"));
class ConfigComparator {
    async compare(repoPath, templatePath, configEntry, templateContent) {
        const repoConfigPath = path_1.default.join(repoPath, configEntry.path);
        const exists = await fs_extra_1.default.pathExists(repoConfigPath);
        const result = {
            path: configEntry.path,
            exists,
            required: configEntry.required,
            parsed: false,
            drifts: []
        };
        if (!exists) {
            if (configEntry.required) {
                result.drifts.push({
                    id: this.generateId(),
                    type: 'file_missing',
                    path: configEntry.path,
                    status: 'risk',
                    description: `必需配置文件缺失: ${configEntry.path}`,
                    severity: 'critical',
                    reason: '模板要求此配置文件必须存在'
                });
            }
            return result;
        }
        try {
            const repoContent = await fs_extra_1.default.readFile(repoConfigPath, 'utf-8');
            result.parsed = true;
            if (templateContent && configEntry.keys) {
                const repoConfig = this.parseConfig(repoContent, configEntry.type);
                const templateConfig = this.parseConfig(templateContent, configEntry.type);
                for (const key of configEntry.keys) {
                    const repoValue = lodash_1.default.get(repoConfig, key);
                    const templateValue = lodash_1.default.get(templateConfig, key);
                    if (repoValue === undefined) {
                        result.drifts.push({
                            id: this.generateId(),
                            type: 'config_missing_key',
                            path: configEntry.path,
                            status: 'risk',
                            description: `配置项缺失: ${configEntry.path} > ${key}`,
                            severity: 'high',
                            reason: '模板要求此配置项必须存在',
                            expected: JSON.stringify(templateValue)
                        });
                    }
                    else if (!lodash_1.default.isEqual(repoValue, templateValue)) {
                        const diffChunks = this.generateConfigDiff(JSON.stringify(templateValue, null, 2), JSON.stringify(repoValue, null, 2));
                        result.drifts.push({
                            id: this.generateId(),
                            type: 'config_value_diff',
                            path: configEntry.path,
                            status: 'risk',
                            description: `配置值不同: ${configEntry.path} > ${key}`,
                            severity: 'medium',
                            reason: '配置值已偏离模板',
                            diff: diffChunks,
                            expected: JSON.stringify(templateValue),
                            actual: JSON.stringify(repoValue)
                        });
                    }
                }
            }
        }
        catch (error) {
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                result.drifts.push({
                    id: this.generateId(),
                    type: 'permission_denied',
                    path: configEntry.path,
                    status: 'unknown',
                    description: `无法读取配置文件: ${configEntry.path}`,
                    severity: 'low',
                    reason: '权限不足'
                });
            }
            else {
                result.drifts.push({
                    id: this.generateId(),
                    type: 'parse_error',
                    path: configEntry.path,
                    status: 'unknown',
                    description: `解析配置文件失败: ${configEntry.path}`,
                    severity: 'medium',
                    reason: error.message
                });
            }
            result.parsed = false;
        }
        return result;
    }
    parseConfig(content, type) {
        switch (type) {
            case 'json':
                try {
                    return JSON.parse(content);
                }
                catch {
                    return json5_1.default.parse(content);
                }
            case 'yaml':
                return js_yaml_1.default.load(content);
            case 'env':
                return this.parseEnv(content);
            default:
                return content;
        }
    }
    parseEnv(content) {
        const result = {};
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                result[key.trim()] = valueParts.join('=').trim();
            }
        }
        return result;
    }
    generateConfigDiff(expected, actual) {
        const diffResult = diff.diffLines(expected, actual);
        const chunks = [];
        let lineCount = 1;
        for (const part of diffResult) {
            const chunk = {
                type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
                content: part.value,
                lineStart: lineCount
            };
            const lines = part.value.split('\n').length - 1;
            lineCount += lines;
            chunk.lineEnd = lineCount - 1;
            chunks.push(chunk);
        }
        return chunks;
    }
    generateId() {
        return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ConfigComparator = ConfigComparator;
