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
exports.TraceParser = void 0;
const fs = __importStar(require("fs"));
class TraceParser {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.missingFieldsSet = new Set();
        this.fieldCaseIssuesMap = new Map();
    }
    parse(tracePath, targetService) {
        this.errors = [];
        this.warnings = [];
        this.missingFieldsSet.clear();
        this.fieldCaseIssuesMap.clear();
        if (!fs.existsSync(tracePath)) {
            this.errors.push({
                field: 'traceFile',
                message: `Trace 文件不存在: ${tracePath}`,
                severity: 'error'
            });
            return this.buildResult([]);
        }
        try {
            const content = fs.readFileSync(tracePath, 'utf-8');
            const rawData = JSON.parse(content);
            const spans = this.extractSpans(rawData);
            const traces = this.groupSpansByTrace(spans, targetService);
            return this.buildResult(traces);
        }
        catch (error) {
            this.errors.push({
                field: 'traceFile',
                message: `Trace 文件解析失败: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'error'
            });
            return this.buildResult([]);
        }
    }
    extractSpans(rawData) {
        const spans = [];
        if (Array.isArray(rawData)) {
            for (const item of rawData) {
                spans.push(...this.extractSpansFromItem(item));
            }
        }
        else if (rawData && typeof rawData === 'object') {
            spans.push(...this.extractSpansFromItem(rawData));
        }
        return spans;
    }
    extractSpansFromItem(item) {
        const spans = [];
        if (item.spans && Array.isArray(item.spans)) {
            for (const rawSpan of item.spans) {
                const span = this.parseSpan(rawSpan, item);
                if (span) {
                    spans.push(span);
                }
            }
        }
        else if (this.looksLikeSpan(item)) {
            const span = this.parseSpan(item, null);
            if (span) {
                spans.push(span);
            }
        }
        if (item.resourceSpans && Array.isArray(item.resourceSpans)) {
            for (const rs of item.resourceSpans) {
                const serviceName = this.extractServiceName(rs.resource);
                if (rs.scopeSpans && Array.isArray(rs.scopeSpans)) {
                    for (const ss of rs.scopeSpans) {
                        if (ss.spans && Array.isArray(ss.spans)) {
                            for (const rawSpan of ss.spans) {
                                const span = this.parseOTelSpan(rawSpan, serviceName);
                                if (span) {
                                    spans.push(span);
                                }
                            }
                        }
                    }
                }
            }
        }
        return spans;
    }
    looksLikeSpan(obj) {
        if (!obj || typeof obj !== 'object')
            return false;
        const spanKeys = ['traceId', 'spanId', 'name', 'startTime'];
        const otelKeys = ['trace_id', 'span_id', 'name', 'start_time_unix_nano'];
        return spanKeys.some(k => k in obj) || otelKeys.some(k => k in obj);
    }
    extractServiceName(resource) {
        if (!resource || !resource.attributes) {
            return 'unknown-service';
        }
        for (const attr of resource.attributes) {
            if (attr.key === 'service.name' || attr.key === 'service_name') {
                return attr.value?.stringValue || attr.value?.STRING_VALUE || 'unknown-service';
            }
        }
        return 'unknown-service';
    }
    parseOTelSpan(rawSpan, defaultServiceName) {
        try {
            const traceId = rawSpan.traceId || rawSpan.trace_id;
            const spanId = rawSpan.spanId || rawSpan.span_id;
            const name = rawSpan.name;
            if (!traceId || !spanId || !name) {
                this.warnings.push({
                    field: 'span',
                    message: '跳过无效 span: 缺少 traceId, spanId 或 name',
                    severity: 'warning'
                });
                return null;
            }
            const serviceName = defaultServiceName;
            const attributes = {};
            if (rawSpan.attributes && Array.isArray(rawSpan.attributes)) {
                for (const attr of rawSpan.attributes) {
                    const key = attr.key;
                    const value = this.extractAttributeValue(attr.value);
                    if (value !== undefined) {
                        attributes[key] = value;
                    }
                }
            }
            return {
                traceId: String(traceId),
                spanId: String(spanId),
                parentSpanId: rawSpan.parentSpanId || rawSpan.parent_span_id ? String(rawSpan.parentSpanId || rawSpan.parent_span_id) : undefined,
                name: String(name),
                serviceName,
                startTime: Number(rawSpan.startTimeUnixNano || rawSpan.start_time_unix_nano || 0),
                endTime: rawSpan.endTimeUnixNano || rawSpan.end_time_unix_nano ? Number(rawSpan.endTimeUnixNano || rawSpan.end_time_unix_nano) : undefined,
                attributes,
                status: rawSpan.status ? {
                    code: Number(rawSpan.status.code || 0),
                    message: rawSpan.status.message
                } : undefined
            };
        }
        catch (error) {
            this.warnings.push({
                field: 'span',
                message: `解析 span 失败: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'warning'
            });
            return null;
        }
    }
    parseSpan(rawSpan, parent) {
        try {
            const traceId = this.getField(rawSpan, ['traceId', 'trace_id', 'traceID']);
            const spanId = this.getField(rawSpan, ['spanId', 'span_id', 'spanID']);
            const name = this.getField(rawSpan, ['name', 'operationName', 'operation_name']);
            if (!traceId || !spanId || !name) {
                this.warnings.push({
                    field: 'span',
                    message: '跳过无效 span: 缺少 traceId, spanId 或 name',
                    severity: 'warning'
                });
                return null;
            }
            const serviceName = this.getField(rawSpan, ['serviceName', 'service_name', 'localEndpoint.serviceName']) ||
                this.getField(parent, ['serviceName', 'service_name']) ||
                'unknown-service';
            this.checkFieldCase(rawSpan, ['traceId', 'trace_id', 'traceID'], 'traceId');
            this.checkFieldCase(rawSpan, ['spanId', 'span_id', 'spanID'], 'spanId');
            this.checkFieldCase(rawSpan, ['serviceName', 'service_name'], 'serviceName');
            if (!serviceName || serviceName === 'unknown-service') {
                this.missingFieldsSet.add('serviceName');
            }
            const startTime = Number(this.getField(rawSpan, ['startTime', 'start_time', 'timestamp']) || 0);
            const duration = Number(this.getField(rawSpan, ['duration', 'duration_ms']) || 0);
            const attributes = {};
            const rawAttrs = rawSpan.attributes || rawSpan.tags;
            if (rawAttrs && typeof rawAttrs === 'object') {
                if (Array.isArray(rawAttrs)) {
                    for (const attr of rawAttrs) {
                        if (attr.key && attr.value !== undefined) {
                            attributes[attr.key] = attr.value;
                        }
                        else if (typeof attr === 'object') {
                            for (const [key, value] of Object.entries(attr)) {
                                attributes[key] = value;
                            }
                        }
                    }
                }
                else {
                    for (const [key, value] of Object.entries(rawAttrs)) {
                        attributes[key] = value;
                    }
                }
            }
            return {
                traceId: String(traceId),
                spanId: String(spanId),
                parentSpanId: this.getField(rawSpan, ['parentSpanId', 'parent_span_id', 'parentSpanID']) ?
                    String(this.getField(rawSpan, ['parentSpanId', 'parent_span_id', 'parentSpanID'])) : undefined,
                name: String(name),
                serviceName: String(serviceName),
                startTime,
                endTime: duration ? startTime + duration * 1000000 : undefined,
                attributes,
                status: rawSpan.status ? {
                    code: Number(rawSpan.status.code || 0),
                    message: rawSpan.status.message
                } : undefined
            };
        }
        catch (error) {
            this.warnings.push({
                field: 'span',
                message: `解析 span 失败: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'warning'
            });
            return null;
        }
    }
    getField(obj, possibleKeys) {
        if (!obj || typeof obj !== 'object')
            return undefined;
        for (const key of possibleKeys) {
            if (key.includes('.')) {
                const parts = key.split('.');
                let value = obj;
                for (const part of parts) {
                    value = value?.[part];
                }
                if (value !== undefined)
                    return value;
            }
            else if (obj[key] !== undefined) {
                return obj[key];
            }
        }
        return undefined;
    }
    checkFieldCase(obj, possibleKeys, canonicalName) {
        if (!obj || typeof obj !== 'object')
            return;
        for (const key of Object.keys(obj)) {
            const lowerKey = key.toLowerCase();
            const matchedKey = possibleKeys.find(k => k.toLowerCase() === lowerKey);
            if (matchedKey && key !== matchedKey) {
                const existing = this.fieldCaseIssuesMap.get(canonicalName) || { count: 0, examples: new Set() };
                existing.count++;
                if (existing.examples.size < 5) {
                    existing.examples.add(key);
                }
                this.fieldCaseIssuesMap.set(canonicalName, existing);
            }
        }
    }
    extractAttributeValue(value) {
        if (!value)
            return undefined;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (value.stringValue !== undefined)
            return value.stringValue;
        if (value.intValue !== undefined)
            return Number(value.intValue);
        if (value.boolValue !== undefined)
            return value.boolValue;
        if (value.doubleValue !== undefined)
            return Number(value.doubleValue);
        const keys = Object.keys(value);
        if (keys.length > 0) {
            return value[keys[0]];
        }
        return undefined;
    }
    groupSpansByTrace(spans, targetService) {
        const traceMap = new Map();
        for (const span of spans) {
            const existing = traceMap.get(span.traceId) || [];
            existing.push(span);
            traceMap.set(span.traceId, existing);
        }
        const traces = [];
        for (const [traceId, traceSpans] of traceMap) {
            const sortedSpans = [...traceSpans].sort((a, b) => a.startTime - b.startTime);
            if (targetService && !sortedSpans.some(s => s.serviceName.toLowerCase().includes(targetService.toLowerCase()))) {
                continue;
            }
            const rootSpan = sortedSpans.find(s => !s.parentSpanId) || sortedSpans[0];
            const serviceNames = [...new Set(sortedSpans.map(s => s.serviceName))];
            const endTimes = sortedSpans.map(s => s.endTime || s.startTime).filter(t => t > 0);
            const maxEndTime = endTimes.length > 0 ? Math.max(...endTimes) : 0;
            const minStartTime = Math.min(...sortedSpans.map(s => s.startTime).filter(t => t > 0));
            traces.push({
                traceId,
                spans: sortedSpans,
                rootSpan,
                serviceNames,
                startTime: minStartTime,
                duration: maxEndTime > minStartTime ? maxEndTime - minStartTime : undefined
            });
        }
        return traces.sort((a, b) => a.startTime - b.startTime);
    }
    buildResult(traces) {
        const fieldCaseIssues = Array.from(this.fieldCaseIssuesMap.entries()).map(([field, data]) => ({
            field,
            occurrences: data.count,
            examples: Array.from(data.examples)
        }));
        return {
            traces,
            errors: [...this.errors],
            warnings: [...this.warnings],
            missingFields: Array.from(this.missingFieldsSet),
            fieldCaseIssues
        };
    }
}
exports.TraceParser = TraceParser;
//# sourceMappingURL=trace-parser.js.map