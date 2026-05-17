"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpRecordParser = void 0;
class HttpRecordParser {
    options;
    constructor(options = {}) {
        this.options = {
            variableRules: options.variableRules || [],
            sensitiveRules: options.sensitiveRules || [],
            variableMappings: options.variableMappings || {},
            preserveBadLines: options.preserveBadLines ?? true,
            failFast: options.failFast ?? false,
        };
    }
    parse(content) {
        const lines = content.split(/\r?\n/);
        const records = [];
        let badLines = 0;
        let validLines = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const line = lines[i].trim();
            if (!line) {
                continue;
            }
            try {
                const record = this.parseLine(line, lineNumber);
                records.push(record);
                if (record.isBadLine) {
                    badLines++;
                }
                else {
                    validLines++;
                }
            }
            catch (error) {
                if (this.options.failFast) {
                    throw error;
                }
                const badRecord = {
                    id: `req-${lineNumber}`,
                    lineNumber,
                    original: line,
                    headers: {},
                    queryParams: {},
                    isBadLine: true,
                    badLineReason: error instanceof Error ? error.message : 'Unknown error',
                    variables: {},
                };
                if (this.options.preserveBadLines) {
                    records.push(badRecord);
                }
                badLines++;
            }
        }
        const variables = this.aggregateVariables(records);
        return {
            records,
            totalLines: lines.filter(l => l.trim()).length,
            validLines,
            badLines,
            variables,
        };
    }
    parseLine(line, lineNumber) {
        const record = {
            id: `req-${lineNumber}`,
            lineNumber,
            original: line,
            headers: {},
            queryParams: {},
            isBadLine: false,
            variables: {},
        };
        try {
            if (this.isJsonFormat(line)) {
                this.parseJsonLine(record, line);
            }
            else if (this.isCurlFormat(line)) {
                this.parseCurlLine(record, line);
            }
            else if (this.isRawHttpRequest(line)) {
                this.parseRawHttpRequest(record, line);
            }
            else {
                this.parseSimpleFormat(record, line);
            }
        }
        catch (error) {
            record.isBadLine = true;
            record.badLineReason = error instanceof Error ? error.message : 'Parse failed';
        }
        return record;
    }
    isJsonFormat(line) {
        try {
            const obj = JSON.parse(line);
            return obj && (obj.url || obj.method || obj.headers || obj.body);
        }
        catch {
            return false;
        }
    }
    isCurlFormat(line) {
        return line.startsWith('curl ');
    }
    isRawHttpRequest(line) {
        return /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+https?:\/\//i.test(line) ||
            /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\//i.test(line);
    }
    parseJsonLine(record, line) {
        const obj = JSON.parse(line);
        if (obj.method)
            record.method = String(obj.method).toUpperCase();
        if (obj.url)
            record.url = String(obj.url);
        if (obj.headers && typeof obj.headers === 'object') {
            record.headers = Object.fromEntries(Object.entries(obj.headers).map(([k, v]) => [k, String(v)]));
        }
        if (obj.body)
            record.body = typeof obj.body === 'string' ? obj.body : JSON.stringify(obj.body);
        if (record.url) {
            this.parseUrlComponents(record, record.url);
        }
    }
    parseCurlLine(record, line) {
        const methodMatch = line.match(/-X\s+(\w+)/);
        if (methodMatch) {
            record.method = methodMatch[1].toUpperCase();
        }
        const urlMatch = line.match(/'([^']+)'|"([^"]+)"|(\S+:\/\/\S+)/);
        if (urlMatch) {
            record.url = urlMatch[1] || urlMatch[2] || urlMatch[3];
            this.parseUrlComponents(record, record.url);
        }
        const headerMatches = line.matchAll(/-H\s+'([^']+)'|-H\s+"([^"]+)"/g);
        for (const match of headerMatches) {
            const headerStr = match[1] || match[2];
            const colonIndex = headerStr.indexOf(':');
            if (colonIndex > 0) {
                const key = headerStr.slice(0, colonIndex).trim();
                const value = headerStr.slice(colonIndex + 1).trim();
                record.headers[key] = value;
            }
        }
        const bodyMatch = line.match(/-d\s+'([^']+)'|-d\s+"([^"]+)"|--data\s+'([^']+)'|--data\s+"([^"]+)"/);
        if (bodyMatch) {
            record.body = bodyMatch[1] || bodyMatch[2] || bodyMatch[3] || bodyMatch[4];
        }
        if (!record.method) {
            record.method = record.body ? 'POST' : 'GET';
        }
    }
    parseRawHttpRequest(record, line) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
            record.method = parts[0].toUpperCase();
            record.url = parts[1];
            this.parseUrlComponents(record, record.url);
        }
    }
    parseSimpleFormat(record, line) {
        if (line.includes('://')) {
            record.url = line;
            record.method = 'GET';
            this.parseUrlComponents(record, record.url);
        }
        else {
            throw new Error('Unrecognized format');
        }
    }
    parseUrlComponents(record, url) {
        try {
            const urlObj = new URL(url);
            record.protocol = urlObj.protocol.replace(':', '');
            record.host = urlObj.host;
            record.path = urlObj.pathname;
            for (const [key, value] of urlObj.searchParams) {
                record.queryParams[key] = value;
            }
        }
        catch {
            const hostMatch = url.match(/https?:\/\/([^/]+)/);
            if (hostMatch) {
                record.host = hostMatch[1];
                record.protocol = url.startsWith('https') ? 'https' : 'http';
            }
            const pathMatch = url.match(/https?:\/\/[^/]+(\/[^?#]*)/);
            if (pathMatch) {
                record.path = pathMatch[1];
            }
        }
    }
    aggregateVariables(records) {
        const varStats = {};
        for (const record of records) {
            if (record.isBadLine)
                continue;
            for (const [name, info] of Object.entries(record.variables)) {
                const existing = varStats[name];
                if (existing) {
                    existing.occurrences += info.occurrences;
                }
                else {
                    varStats[name] = {
                        name,
                        value: info.value,
                        type: info.type,
                        location: info.location,
                        occurrences: info.occurrences,
                    };
                }
            }
        }
        return varStats;
    }
}
exports.HttpRecordParser = HttpRecordParser;
