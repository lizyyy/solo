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
exports.ConfigParser = void 0;
const fs = __importStar(require("fs"));
const types_1 = require("./types");
class ConfigParser {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }
    parse(configPath) {
        this.errors = [];
        this.warnings = [];
        if (!fs.existsSync(configPath)) {
            this.errors.push({
                field: 'configFile',
                message: `配置文件不存在: ${configPath}`,
                severity: 'error'
            });
            return null;
        }
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const rawConfig = JSON.parse(content);
            return this.validateAndTransform(rawConfig);
        }
        catch (error) {
            this.errors.push({
                field: 'configFile',
                message: `配置文件解析失败: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'error'
            });
            return null;
        }
    }
    validateAndTransform(raw) {
        if (!raw || typeof raw !== 'object') {
            this.errors.push({
                field: 'root',
                message: '配置必须是一个对象',
                severity: 'error'
            });
            return null;
        }
        const version = this.validateVersion(raw.version);
        const defaultSamplingRatio = this.validateSamplingRatio(raw.defaultSamplingRatio, 'defaultSamplingRatio');
        const defaultDecision = this.validateDecision(raw.defaultDecision, 'defaultDecision');
        const rules = this.validateRules(raw.rules);
        if (this.errors.length > 0) {
            return null;
        }
        const config = {
            version: version,
            defaultSamplingRatio: defaultSamplingRatio,
            defaultDecision: defaultDecision,
            rules: rules,
            globalPerSecondLimit: this.validateOptionalNumber(raw.globalPerSecondLimit, 'globalPerSecondLimit'),
            caseSensitive: raw.caseSensitive !== undefined ? Boolean(raw.caseSensitive) : false,
            strictAttributeMatch: raw.strictAttributeMatch !== undefined ? Boolean(raw.strictAttributeMatch) : false
        };
        this.validateRuleConsistency(config);
        return config;
    }
    validateVersion(version) {
        if (!version || typeof version !== 'string') {
            this.errors.push({
                field: 'version',
                message: 'version 是必填的字符串字段',
                severity: 'error'
            });
            return null;
        }
        return version;
    }
    validateSamplingRatio(ratio, field) {
        if (ratio === undefined || ratio === null) {
            this.errors.push({
                field,
                message: `${field} 是必填字段`,
                severity: 'error'
            });
            return null;
        }
        const num = Number(ratio);
        if (isNaN(num) || num < 0 || num > 1) {
            this.errors.push({
                field,
                message: `${field} 必须是 0 到 1 之间的数字`,
                severity: 'error'
            });
            return null;
        }
        return num;
    }
    validateOptionalNumber(value, field) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const num = Number(value);
        if (isNaN(num) || num < 0) {
            this.warnings.push({
                field,
                message: `${field} 必须是非负数字，已忽略`,
                severity: 'warning'
            });
            return undefined;
        }
        return num;
    }
    validateDecision(decision, field) {
        if (!decision) {
            this.errors.push({
                field,
                message: `${field} 是必填字段`,
                severity: 'error'
            });
            return null;
        }
        const validDecisions = Object.values(types_1.SamplingDecision);
        if (!validDecisions.includes(decision)) {
            this.errors.push({
                field,
                message: `${field} 必须是以下值之一: ${validDecisions.join(', ')}`,
                severity: 'error'
            });
            return null;
        }
        return decision;
    }
    validateRules(rules) {
        if (!Array.isArray(rules)) {
            this.errors.push({
                field: 'rules',
                message: 'rules 必须是数组',
                severity: 'error'
            });
            return null;
        }
        const validatedRules = [];
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const prefix = `rules[${i}]`;
            if (!rule || typeof rule !== 'object') {
                this.errors.push({
                    field: prefix,
                    message: `${prefix} 必须是对象`,
                    severity: 'error'
                });
                continue;
            }
            const name = this.validateRuleName(rule.name, prefix);
            const priority = this.validateRulePriority(rule.priority, prefix);
            const samplingRatio = this.validateSamplingRatio(rule.samplingRatio, `${prefix}.samplingRatio`);
            const decision = this.validateDecision(rule.decision, `${prefix}.decision`);
            if (!name || priority === null || samplingRatio === null || !decision) {
                continue;
            }
            validatedRules.push({
                name,
                description: rule.description,
                priority,
                serviceName: rule.serviceName,
                serviceNamePattern: rule.serviceNamePattern,
                attributes: this.validateAttributes(rule.attributes, `${prefix}.attributes`),
                samplingRatio,
                perSecondLimit: this.validateOptionalNumber(rule.perSecondLimit, `${prefix}.perSecondLimit`),
                decision
            });
        }
        return validatedRules;
    }
    validateRuleName(name, prefix) {
        if (!name || typeof name !== 'string') {
            this.errors.push({
                field: `${prefix}.name`,
                message: `${prefix}.name 是必填的字符串字段`,
                severity: 'error'
            });
            return null;
        }
        return name;
    }
    validateRulePriority(priority, prefix) {
        if (priority === undefined || priority === null) {
            this.errors.push({
                field: `${prefix}.priority`,
                message: `${prefix}.priority 是必填字段`,
                severity: 'error'
            });
            return null;
        }
        const num = Number(priority);
        if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            this.errors.push({
                field: `${prefix}.priority`,
                message: `${prefix}.priority 必须是非负整数`,
                severity: 'error'
            });
            return null;
        }
        return num;
    }
    validateAttributes(attributes, field) {
        if (attributes === undefined || attributes === null) {
            return undefined;
        }
        if (!Array.isArray(attributes)) {
            this.warnings.push({
                field,
                message: `${field} 必须是数组，已忽略`,
                severity: 'warning'
            });
            return undefined;
        }
        return attributes.filter((attr, index) => {
            if (!attr || typeof attr !== 'object') {
                this.warnings.push({
                    field: `${field}[${index}]`,
                    message: `${field}[${index}] 必须是对象，已忽略`,
                    severity: 'warning'
                });
                return false;
            }
            if (!attr.key || typeof attr.key !== 'string') {
                this.warnings.push({
                    field: `${field}[${index}].key`,
                    message: `${field}[${index}].key 是必填的字符串字段，已忽略该属性`,
                    severity: 'warning'
                });
                return false;
            }
            return true;
        });
    }
    validateRuleConsistency(config) {
        const nameSet = new Set();
        for (const rule of config.rules) {
            if (nameSet.has(rule.name)) {
                this.warnings.push({
                    field: `rules`,
                    message: `存在重复的规则名称: ${rule.name}，可能导致意外行为`,
                    severity: 'warning'
                });
            }
            nameSet.add(rule.name);
            if (rule.serviceName && rule.serviceNamePattern) {
                this.warnings.push({
                    field: `rules.${rule.name}`,
                    message: `规则同时指定了 serviceName 和 serviceNamePattern，将优先使用 serviceName`,
                    severity: 'warning'
                });
            }
            if (rule.attributes && rule.attributes.length > 0) {
                for (const attr of rule.attributes) {
                    if (attr.value !== undefined && attr.pattern !== undefined) {
                        this.warnings.push({
                            field: `rules.${rule.name}.attributes.${attr.key}`,
                            message: `属性同时指定了 value 和 pattern，将优先使用 value`,
                            severity: 'warning'
                        });
                    }
                }
            }
        }
    }
    getErrors() {
        return this.errors;
    }
    getWarnings() {
        return this.warnings;
    }
    isValid() {
        return this.errors.length === 0;
    }
}
exports.ConfigParser = ConfigParser;
//# sourceMappingURL=config-parser.js.map