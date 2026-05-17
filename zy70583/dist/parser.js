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
exports.DataParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
class DataParser {
    errors = [];
    getParseErrors() {
        return this.errors;
    }
    clearErrors() {
        this.errors = [];
    }
    addError(file, error, lineNumber, rawContent) {
        this.errors.push({
            file,
            lineNumber,
            rawContent,
            error,
            timestamp: Date.now(),
        });
    }
    parseAlerts(filePath) {
        const content = this.readFile(filePath);
        if (!content)
            return [];
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return this.parseAlertsJson(content, filePath);
        }
        else if (ext === '.csv') {
            return this.parseAlertsCsv(content, filePath);
        }
        else {
            this.addError(filePath, `不支持的文件格式: ${ext}`);
            return [];
        }
    }
    parseRules(filePath) {
        const content = this.readFile(filePath);
        if (!content)
            return [];
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return this.parseRulesJson(content, filePath);
        }
        else if (ext === '.csv') {
            return this.parseRulesCsv(content, filePath);
        }
        else {
            this.addError(filePath, `不支持的文件格式: ${ext}`);
            return [];
        }
    }
    parseSilences(filePath) {
        const content = this.readFile(filePath);
        if (!content)
            return [];
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return this.parseSilencesJson(content, filePath);
        }
        else if (ext === '.csv') {
            return this.parseSilencesCsv(content, filePath);
        }
        else {
            this.addError(filePath, `不支持的文件格式: ${ext}`);
            return [];
        }
    }
    readFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                this.addError(filePath, '文件不存在');
                return null;
            }
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch (e) {
            this.addError(filePath, `读取文件失败: ${e.message}`);
            return null;
        }
    }
    parseAlertsJson(content, filePath) {
        try {
            const data = JSON.parse(content);
            const alerts = [];
            const rawAlerts = Array.isArray(data) ? data : data.data || data.alerts || [];
            rawAlerts.forEach((item, index) => {
                try {
                    alerts.push(this.validateAlert(item, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 1, JSON.stringify(item));
                }
            });
            return alerts;
        }
        catch (e) {
            this.addError(filePath, `JSON解析失败: ${e.message}`);
            return [];
        }
    }
    parseAlertsCsv(content, filePath) {
        try {
            const records = (0, sync_1.parse)(content, {
                columns: true,
                skip_empty_lines: true,
                relax_column_count: true,
            });
            const alerts = [];
            records.forEach((record, index) => {
                try {
                    const alert = {
                        id: record.id || `alert-${index}`,
                        ruleName: record.ruleName || record.rule_name || '',
                        ruleId: record.ruleId || record.rule_id || '',
                        severity: (record.severity || 'info'),
                        timestamp: this.parseTimestamp(record.timestamp || record.time),
                        labels: this.parseJsonField(record.labels, {}),
                        annotations: this.parseJsonField(record.annotations, {}),
                        fingerprint: record.fingerprint,
                    };
                    alerts.push(this.validateAlert(alert, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 2, JSON.stringify(record));
                }
            });
            return alerts;
        }
        catch (e) {
            this.addError(filePath, `CSV解析失败: ${e.message}`);
            return [];
        }
    }
    parseRulesJson(content, filePath) {
        try {
            const data = JSON.parse(content);
            const rules = [];
            const rawRules = Array.isArray(data) ? data : data.data || data.rules || [];
            rawRules.forEach((item, index) => {
                try {
                    rules.push(this.validateRule(item, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 1, JSON.stringify(item));
                }
            });
            return rules;
        }
        catch (e) {
            this.addError(filePath, `JSON解析失败: ${e.message}`);
            return [];
        }
    }
    parseRulesCsv(content, filePath) {
        try {
            const records = (0, sync_1.parse)(content, {
                columns: true,
                skip_empty_lines: true,
                relax_column_count: true,
            });
            const rules = [];
            records.forEach((record, index) => {
                try {
                    const rule = {
                        id: record.id || `rule-${index}`,
                        name: record.name || '',
                        expr: record.expr || record.expression || '',
                        severity: record.severity || 'info',
                        labels: this.parseJsonField(record.labels, {}),
                        annotations: this.parseJsonField(record.annotations, {}),
                    };
                    rules.push(this.validateRule(rule, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 2, JSON.stringify(record));
                }
            });
            return rules;
        }
        catch (e) {
            this.addError(filePath, `CSV解析失败: ${e.message}`);
            return [];
        }
    }
    parseSilencesJson(content, filePath) {
        try {
            const data = JSON.parse(content);
            const silences = [];
            const rawSilences = Array.isArray(data) ? data : data.data || data.silences || [];
            rawSilences.forEach((item, index) => {
                try {
                    silences.push(this.validateSilence(item, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 1, JSON.stringify(item));
                }
            });
            return silences;
        }
        catch (e) {
            this.addError(filePath, `JSON解析失败: ${e.message}`);
            return [];
        }
    }
    parseSilencesCsv(content, filePath) {
        try {
            const records = (0, sync_1.parse)(content, {
                columns: true,
                skip_empty_lines: true,
                relax_column_count: true,
            });
            const silences = [];
            records.forEach((record, index) => {
                try {
                    const silence = {
                        id: record.id || `silence-${index}`,
                        comment: record.comment || '',
                        createdBy: record.createdBy || record.created_by || '',
                        startsAt: this.parseTimestamp(record.startsAt || record.starts_at),
                        endsAt: this.parseTimestamp(record.endsAt || record.ends_at),
                        matchers: this.parseJsonField(record.matchers, []),
                        status: (record.status || 'active'),
                    };
                    silences.push(this.validateSilence(silence, index + 1));
                }
                catch (e) {
                    this.addError(filePath, e.message, index + 2, JSON.stringify(record));
                }
            });
            return silences;
        }
        catch (e) {
            this.addError(filePath, `CSV解析失败: ${e.message}`);
            return [];
        }
    }
    validateAlert(item, lineNumber) {
        if (!item.ruleId && !item.ruleName) {
            throw new Error(`告警缺少 ruleId 或 ruleName`);
        }
        return {
            id: item.id || `alert-${lineNumber}`,
            ruleName: item.ruleName || '',
            ruleId: item.ruleId || '',
            severity: item.severity || 'info',
            timestamp: item.timestamp || Date.now(),
            labels: item.labels || {},
            annotations: item.annotations || {},
            fingerprint: item.fingerprint,
        };
    }
    validateRule(item, lineNumber) {
        if (!item.name) {
            throw new Error(`规则缺少 name`);
        }
        return {
            id: item.id || `rule-${lineNumber}`,
            name: item.name,
            expr: item.expr || '',
            severity: item.severity || 'info',
            labels: item.labels || {},
            annotations: item.annotations || {},
        };
    }
    validateSilence(item, lineNumber) {
        if (!item.matchers || !Array.isArray(item.matchers)) {
            throw new Error(`静默配置缺少 matchers 数组`);
        }
        return {
            id: item.id || `silence-${lineNumber}`,
            comment: item.comment || '',
            createdBy: item.createdBy || '',
            startsAt: item.startsAt || Date.now(),
            endsAt: item.endsAt || Date.now() + 86400000,
            matchers: item.matchers,
            status: item.status || 'active',
        };
    }
    parseTimestamp(value) {
        if (!value)
            return Date.now();
        if (typeof value === 'number')
            return value;
        const parsed = Date.parse(value);
        return isNaN(parsed) ? Date.now() : parsed;
    }
    parseJsonField(value, defaultValue) {
        if (!value)
            return defaultValue;
        if (typeof value === 'object')
            return value;
        try {
            return JSON.parse(value);
        }
        catch {
            return defaultValue;
        }
    }
}
exports.DataParser = DataParser;
