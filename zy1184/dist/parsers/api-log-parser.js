"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiLogParser = void 0;
exports.parseApiLog = parseApiLog;
const id_generator_1 = require("../utils/id-generator");
const date_utils_1 = require("../utils/date-utils");
class ApiLogParser {
    constructor(options = {}) {
        this.options = {
            format: 'json',
            requestIdField: 'requestId',
            durationField: 'duration',
            ...options,
        };
    }
    parse(content) {
        switch (this.options.format) {
            case 'json':
                return this.parseJsonFormat(content);
            case 'csv':
                return this.parseCsvFormat(content);
            case 'plain':
            default:
                return this.parsePlainFormat(content);
        }
    }
    parseJsonFormat(content) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data.map(item => this.parseJsonItem(item));
            }
            return [this.parseJsonItem(data)];
        }
        catch {
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            return lines.map(line => {
                try {
                    return this.parseJsonItem(JSON.parse(line));
                }
                catch {
                    return null;
                }
            }).filter((log) => log !== null);
        }
    }
    parseJsonItem(item) {
        const requestIdField = this.options.requestIdField || 'requestId';
        const durationField = this.options.durationField || 'duration';
        const method = this.parseMethod(item.method || item.httpMethod);
        const statusCode = item.statusCode || item.status || 200;
        return {
            id: item.id || (0, id_generator_1.generateId)(),
            requestId: item[requestIdField] || item.request_id || item.traceId || item.trace_id || '',
            timestamp: item.timestamp ? (0, date_utils_1.parseDate)(item.timestamp) : new Date(),
            method,
            path: item.path || item.url || item.uri || '',
            statusCode: typeof statusCode === 'string' ? parseInt(statusCode, 10) : statusCode,
            duration: item[durationField]
                ? (0, date_utils_1.durationToMs)(String(item[durationField]), this.options.durationUnit === 's' ? 's' : 'ms')
                : item.responseTime || item.executionTime || 0,
            userId: item.userId || item.user_id || item.user,
            userAgent: item.userAgent || item.user_agent,
            ip: item.ip || item.remoteIp || item.clientIp,
            queryParams: item.queryParams || item.query || item.queryParameters,
            requestBody: item.requestBody || item.body,
            responseBody: item.responseBody || item.response,
            metadata: item.metadata || item.meta,
        };
    }
    parseCsvFormat(content) {
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2)
            return [];
        const headers = this.parseCsvLine(lines[0]);
        const logs = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            const item = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    item[header.trim()] = values[index].trim();
                }
            });
            logs.push(this.parseJsonItem(item));
        }
        return logs;
    }
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }
    parsePlainFormat(content) {
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        const logs = [];
        for (const line of lines) {
            const log = this.parsePlainLine(line);
            if (log) {
                logs.push(log);
            }
        }
        return logs;
    }
    parsePlainLine(line) {
        const log = {
            id: (0, id_generator_1.generateId)(),
        };
        const timestampMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/);
        if (timestampMatch) {
            log.timestamp = (0, date_utils_1.parseDate)(timestampMatch[1]);
        }
        const methodMatch = line.match(/\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/i);
        if (methodMatch) {
            log.method = this.parseMethod(methodMatch[1]);
        }
        const pathMatch = line.match(/(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(\/\S*)/i);
        if (pathMatch) {
            log.path = pathMatch[1];
        }
        const statusMatch = line.match(/\b(\d{3})\b/);
        if (statusMatch) {
            log.statusCode = parseInt(statusMatch[1], 10);
        }
        const durationMatch = line.match(/(\d+(?:\.\d+)?)\s*(ms|s|μs|us)/i);
        if (durationMatch) {
            const unit = durationMatch[2].toLowerCase() === 's' ? 's' :
                durationMatch[2].toLowerCase() === 'us' || durationMatch[2].toLowerCase() === 'μs' ? 'us' : 'ms';
            log.duration = (0, date_utils_1.durationToMs)(durationMatch[1], unit);
        }
        const requestIdMatch = line.match(/(?:requestId|request_id|traceId|trace_id):?\s*([a-zA-Z0-9_-]+)/i);
        if (requestIdMatch) {
            log.requestId = requestIdMatch[1];
        }
        if (!log.method || !log.path) {
            return null;
        }
        return {
            id: log.id || (0, id_generator_1.generateId)(),
            requestId: log.requestId || '',
            timestamp: log.timestamp || new Date(),
            method: log.method || 'GET',
            path: log.path || '',
            statusCode: log.statusCode || 200,
            duration: log.duration || 0,
            userId: log.userId,
            userAgent: log.userAgent,
            ip: log.ip,
            queryParams: log.queryParams,
            requestBody: log.requestBody,
            responseBody: log.responseBody,
            metadata: log.metadata,
        };
    }
    parseMethod(method) {
        const upperMethod = method?.toUpperCase();
        switch (upperMethod) {
            case 'GET':
            case 'POST':
            case 'PUT':
            case 'DELETE':
            case 'PATCH':
                return upperMethod;
            default:
                return 'GET';
        }
    }
}
exports.ApiLogParser = ApiLogParser;
function parseApiLog(content, options) {
    const parser = new ApiLogParser(options);
    return parser.parse(content);
}
//# sourceMappingURL=api-log-parser.js.map