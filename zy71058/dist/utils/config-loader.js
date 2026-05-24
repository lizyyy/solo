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
exports.loadRules = loadRules;
exports.loadExceptions = loadExceptions;
exports.validateOptions = validateOptions;
exports.ensureOutputDir = ensureOutputDir;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const default_rules_1 = require("../config/default-rules");
function loadRules(rulesPath) {
    if (!rulesPath) {
        return default_rules_1.defaultRules;
    }
    if (!fs.existsSync(rulesPath)) {
        throw new Error(`规则文件不存在: ${rulesPath}`);
    }
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const parsed = yaml.load(content);
    if (!parsed.rules || !Array.isArray(parsed.rules)) {
        throw new Error('规则文件格式错误: 缺少 rules 数组');
    }
    return parsed.rules;
}
function loadExceptions(exceptionsPath) {
    if (!exceptionsPath) {
        return [];
    }
    if (!fs.existsSync(exceptionsPath)) {
        throw new Error(`例外配置文件不存在: ${exceptionsPath}`);
    }
    const content = fs.readFileSync(exceptionsPath, 'utf-8');
    const parsed = yaml.load(content);
    if (!parsed.exceptions || !Array.isArray(parsed.exceptions)) {
        throw new Error('例外配置文件格式错误: 缺少 exceptions 数组');
    }
    return parsed.exceptions;
}
function validateOptions(options) {
    const errors = [];
    if (!options.valuesPath) {
        errors.push({ field: 'valuesPath', message: 'values 文件路径是必需的' });
    }
    else if (typeof options.valuesPath === 'string' && !fs.existsSync(options.valuesPath)) {
        errors.push({ field: 'valuesPath', message: `values 文件不存在: ${options.valuesPath}` });
    }
    if (options.templateDir && typeof options.templateDir === 'string' && !fs.existsSync(options.templateDir)) {
        errors.push({ field: 'templateDir', message: `模板目录不存在: ${options.templateDir}` });
    }
    if (options.rulesPath && typeof options.rulesPath === 'string' && !fs.existsSync(options.rulesPath)) {
        errors.push({ field: 'rulesPath', message: `规则文件不存在: ${options.rulesPath}` });
    }
    if (options.exceptionsPath && typeof options.exceptionsPath === 'string' && !fs.existsSync(options.exceptionsPath)) {
        errors.push({ field: 'exceptionsPath', message: `例外配置文件不存在: ${options.exceptionsPath}` });
    }
    if (!options.environment) {
        errors.push({ field: 'environment', message: '环境名是必需的 (如: prod, staging, test)' });
    }
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (options.failOnSeverity && Array.isArray(options.failOnSeverity)) {
        for (const s of options.failOnSeverity) {
            if (!validSeverities.includes(s)) {
                errors.push({ field: 'failOnSeverity', message: `无效的严重级别: ${s}。有效值: ${validSeverities.join(', ')}` });
            }
        }
    }
    return errors;
}
function ensureOutputDir(outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
}
