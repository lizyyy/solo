"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMaskingRules = exports.MaskingEngine = void 0;
exports.createMaskingEngine = createMaskingEngine;
exports.loadConfigFromFile = loadConfigFromFile;
exports.getDefaultConfig = getDefaultConfig;
class MaskingEngine {
    constructor(config) {
        this.compiledPatterns = new Map();
        this.rules = config.maskingRules || [];
        this.compilePatterns();
    }
    compilePatterns() {
        for (const rule of this.rules) {
            if (rule.pattern) {
                try {
                    const regex = new RegExp(rule.pattern, 'g');
                    this.compiledPatterns.set(rule.field, regex);
                }
                catch (error) {
                    console.warn(`无效的正则表达式 [${rule.field}]: ${rule.pattern}`);
                }
            }
        }
    }
    maskRequest(request) {
        const masked = JSON.parse(JSON.stringify(request));
        if (masked.headers) {
            masked.headers = this.maskHeaders(masked.headers);
        }
        if (masked.query) {
            masked.query = this.maskQuery(masked.query);
        }
        if (masked.uri) {
            masked.uri = this.maskUrl(masked.uri);
        }
        if (masked.body !== undefined) {
            masked.body = this.maskBody(masked.body);
        }
        return masked;
    }
    maskResponse(response) {
        const masked = JSON.parse(JSON.stringify(response));
        if (masked.headers) {
            masked.headers = this.maskHeaders(masked.headers);
        }
        if (masked.body !== undefined) {
            masked.body = this.maskBody(masked.body);
        }
        return masked;
    }
    maskHeaders(headers) {
        const result = {};
        for (const [key, value] of Object.entries(headers)) {
            const rule = this.findRule('header', key);
            if (rule) {
                if (Array.isArray(value)) {
                    result[key] = value.map(v => this.applyRule(v, rule));
                }
                else {
                    result[key] = this.applyRule(value, rule);
                }
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    maskQuery(query) {
        const result = {};
        for (const [key, value] of Object.entries(query)) {
            const rule = this.findRule('query', key);
            if (rule) {
                if (Array.isArray(value)) {
                    result[key] = value.map(v => this.applyRule(v, rule));
                }
                else {
                    result[key] = this.applyRule(value, rule);
                }
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    maskUrl(url) {
        const urlRules = this.rules.filter(r => r.type === 'url');
        let result = url;
        for (const rule of urlRules) {
            const pattern = this.compiledPatterns.get(rule.field);
            if (pattern && rule.replacement) {
                result = result.replace(pattern, rule.replacement);
            }
        }
        return result;
    }
    maskBody(body) {
        if (body === null || body === undefined) {
            return body;
        }
        if (typeof body === 'string') {
            return this.maskString(body);
        }
        if (Array.isArray(body)) {
            return body.map(item => this.maskBody(item));
        }
        if (typeof body === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(body)) {
                const rule = this.findRule('body', key);
                if (rule && typeof value === 'string') {
                    result[key] = this.applyRule(value, rule);
                }
                else {
                    result[key] = this.maskBody(value);
                }
            }
            return result;
        }
        return body;
    }
    maskString(str) {
        let result = str;
        for (const rule of this.rules.filter(r => r.type === 'body')) {
            const pattern = this.compiledPatterns.get(rule.field);
            if (pattern && rule.replacement) {
                result = result.replace(pattern, rule.replacement);
            }
        }
        return result;
    }
    findRule(type, field) {
        return this.rules.find(rule => {
            if (rule.type !== type)
                return false;
            if (rule.field === field)
                return true;
            if (rule.field.includes('*')) {
                const pattern = '^' + rule.field.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
                return new RegExp(pattern).test(field);
            }
            return false;
        });
    }
    applyRule(value, rule) {
        const pattern = this.compiledPatterns.get(rule.field);
        if (pattern && rule.replacement) {
            return value.replace(pattern, rule.replacement);
        }
        if (rule.replacement) {
            return rule.replacement;
        }
        return '***MASKED***';
    }
    verifyMasking(original, masked) {
        for (const rule of this.rules) {
            const pattern = this.compiledPatterns.get(rule.field);
            if (pattern) {
                const testOriginal = pattern.test(original);
                const testMasked = pattern.test(masked);
                if (testOriginal && !testMasked) {
                    return {
                        applied: true,
                        originalValue: original,
                        maskedValue: masked,
                        rule
                    };
                }
            }
        }
        return null;
    }
    detectMaskingIssues(expectedBody, actualBody, path = '') {
        const issues = [];
        if (expectedBody === null || actualBody === null) {
            return issues;
        }
        if (typeof expectedBody === 'string' && typeof actualBody === 'string') {
            const maskPlaceholders = ['***', 'MASKED', 'XXXXX', '_____'];
            const expectedHasMask = maskPlaceholders.some(p => expectedBody.includes(p));
            const actualHasMask = maskPlaceholders.some(p => actualBody.includes(p));
            if (expectedHasMask !== actualHasMask) {
                issues.push({
                    path,
                    issue: `脱敏占位不一致 - 期望值${expectedHasMask ? '包含' : '不包含'}占位符，实际值${actualHasMask ? '包含' : '不包含'}`,
                    suggestion: '检查脱敏规则是否正确应用，或更新期望值'
                });
            }
            if (expectedBody !== actualBody && expectedHasMask && actualHasMask) {
                issues.push({
                    path,
                    issue: '脱敏占位符格式不一致',
                    suggestion: '统一脱敏占位符格式，确保两边使用相同的替换文本'
                });
            }
        }
        if (typeof expectedBody === 'object' && typeof actualBody === 'object') {
            const expectedKeys = Object.keys(expectedBody);
            const actualKeys = Object.keys(actualBody);
            for (const key of expectedKeys) {
                if (actualKeys.includes(key)) {
                    const subPath = path ? `${path}.${key}` : key;
                    issues.push(...this.detectMaskingIssues(expectedBody[key], actualBody[key], subPath));
                }
            }
        }
        return issues;
    }
}
exports.MaskingEngine = MaskingEngine;
function createMaskingEngine(config) {
    return new MaskingEngine(config);
}
exports.defaultMaskingRules = [
    {
        field: 'authorization',
        type: 'header',
        pattern: '^Bearer\\s+.+$',
        replacement: 'Bearer ***MASKED***'
    },
    {
        field: 'token',
        type: 'body',
        pattern: '.+',
        replacement: '***MASKED***'
    },
    {
        field: 'password',
        type: 'body',
        pattern: '.+',
        replacement: '***MASKED***'
    },
    {
        field: 'secret',
        type: 'body',
        pattern: '.+',
        replacement: '***MASKED***'
    }
];
function loadConfigFromFile(filePath) {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    let config;
    if (ext === '.yaml' || ext === '.yml') {
        config = yaml.load(content);
    }
    else {
        config = JSON.parse(content);
    }
    return {
        ignoreOrder: config.ignoreOrder ?? true,
        ignoreFields: config.ignoreFields || [],
        maskingRules: config.maskingRules || exports.defaultMaskingRules,
        normalizeHeaders: config.normalizeHeaders ?? true,
        normalizeJsonKeys: config.normalizeJsonKeys ?? true,
        tolerance: config.tolerance || 0.8
    };
}
function getDefaultConfig() {
    return {
        ignoreOrder: true,
        ignoreFields: [
            'body.id',
            'body.created_at',
            'body.updated_at',
            'body.timestamp',
            'query.timestamp',
            'query.nonce',
            'header.x-request-id',
            'header.x-trace-id'
        ],
        maskingRules: exports.defaultMaskingRules,
        normalizeHeaders: true,
        normalizeJsonKeys: true,
        tolerance: 0.8
    };
}
//# sourceMappingURL=masking-engine.js.map