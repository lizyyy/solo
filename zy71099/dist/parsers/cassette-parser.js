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
exports.CassetteParser = void 0;
exports.parseCassette = parseCassette;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const types_1 = require("../types");
class CassetteParser {
    constructor(filePath) {
        this.rawContent = '';
        this.filePath = path.resolve(filePath);
    }
    async parse() {
        this.validateFileExists();
        this.rawContent = await this.readFile();
        const format = this.detectFormat();
        try {
            if (format === 'yaml') {
                return this.parseYaml();
            }
            else {
                return this.parseJson();
            }
        }
        catch (error) {
            throw this.createParseError(error);
        }
    }
    validateFileExists() {
        if (!fs.existsSync(this.filePath)) {
            const error = {
                message: `文件不存在: ${this.filePath}`,
                code: types_1.ExitCodes.INPUT_ERROR
            };
            throw error;
        }
        const stats = fs.statSync(this.filePath);
        if (!stats.isFile()) {
            const error = {
                message: `路径不是文件: ${this.filePath}`,
                code: types_1.ExitCodes.INPUT_ERROR
            };
            throw error;
        }
    }
    async readFile() {
        return fs.promises.readFile(this.filePath, 'utf-8');
    }
    detectFormat() {
        const ext = path.extname(this.filePath).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
            return 'yaml';
        }
        if (ext === '.json') {
            return 'json';
        }
        const trimmed = this.rawContent.trimStart();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return 'json';
        }
        return 'yaml';
    }
    parseYaml() {
        const lineOffsets = this.getLineOffsets();
        const doc = yaml.load(this.rawContent, {
            filename: this.filePath,
            onWarning: (warning) => {
                console.warn(`YAML 警告: ${warning.message}`);
            }
        });
        return this.normalizeCassette(doc, 'yaml', lineOffsets);
    }
    parseJson() {
        const lineOffsets = this.getLineOffsets();
        const doc = JSON.parse(this.rawContent);
        return this.normalizeCassette(doc, 'json', lineOffsets);
    }
    getLineOffsets() {
        const offsets = [0];
        let index = this.rawContent.indexOf('\n');
        while (index !== -1) {
            offsets.push(index + 1);
            index = this.rawContent.indexOf('\n', index + 1);
        }
        return offsets;
    }
    findLineNumber(position, lineOffsets) {
        for (let i = 0; i < lineOffsets.length; i++) {
            if (position < lineOffsets[i]) {
                return i;
            }
        }
        return lineOffsets.length;
    }
    normalizeCassette(doc, format, lineOffsets) {
        if (!doc) {
            throw { message: 'Cassette 文件为空', code: types_1.ExitCodes.PARSE_ERROR };
        }
        let interactions = [];
        let version;
        if (Array.isArray(doc)) {
            interactions = doc;
        }
        else if (doc.http_interactions) {
            interactions = doc.http_interactions.interactions || doc.http_interactions || [];
            version = doc.version;
        }
        else if (doc.interactions) {
            interactions = doc.interactions;
            version = doc.version;
        }
        else {
            interactions = [doc];
        }
        const normalizedInteractions = interactions.map((interaction, index) => this.normalizeInteraction(interaction, index, lineOffsets));
        return {
            version,
            interactions: normalizedInteractions,
            rawContent: this.rawContent,
            filePath: this.filePath,
            format
        };
    }
    normalizeInteraction(interaction, index, lineOffsets) {
        const request = this.normalizeRequest(interaction.request || interaction);
        const response = this.normalizeResponse(interaction.response || interaction);
        const sourceLine = this.estimateInteractionLine(interaction, index, lineOffsets);
        return {
            id: this.generateInteractionId(request, index),
            request,
            response,
            recordedAt: interaction.recorded_at || interaction.timestamp,
            duration: interaction.duration,
            sourceLine,
            sourceFile: this.filePath
        };
    }
    normalizeRequest(req) {
        const method = (req.method || 'GET').toUpperCase();
        const uri = req.uri || req.url || req.path || '/';
        const headers = this.normalizeHeaders(req.headers);
        const body = this.normalizeBody(req.body, headers);
        const query = this.extractQueryParams(uri, req.query);
        return {
            method,
            uri: this.stripQueryString(uri),
            url: uri,
            headers,
            body,
            query
        };
    }
    normalizeResponse(res) {
        const status = {
            code: res.status?.code || res.status_code || res.status || 200,
            message: res.status?.message || res.statusText
        };
        const headers = this.normalizeHeaders(res.headers);
        const body = this.normalizeBody(res.body, headers);
        return {
            status,
            headers,
            body
        };
    }
    normalizeHeaders(headers) {
        if (!headers)
            return {};
        const normalized = {};
        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();
            if (Array.isArray(value) && value.length === 1) {
                normalized[lowerKey] = value[0];
            }
            else {
                normalized[lowerKey] = value;
            }
        }
        return normalized;
    }
    normalizeBody(body, headers) {
        if (body === undefined || body === null) {
            return undefined;
        }
        if (typeof body === 'object') {
            return body;
        }
        if (typeof body === 'string') {
            const contentType = String(headers['content-type'] || '');
            if (contentType.includes('application/json') || this.looksLikeJson(body)) {
                try {
                    return JSON.parse(body);
                }
                catch {
                    return body;
                }
            }
            return body;
        }
        return String(body);
    }
    looksLikeJson(str) {
        const trimmed = str.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'));
    }
    extractQueryParams(uri, existingQuery) {
        const query = { ...existingQuery };
        const queryIndex = uri.indexOf('?');
        if (queryIndex !== -1) {
            const queryString = uri.substring(queryIndex + 1);
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params.entries()) {
                if (query[key]) {
                    if (!Array.isArray(query[key])) {
                        query[key] = [query[key]];
                    }
                    query[key].push(value);
                }
                else {
                    query[key] = value;
                }
            }
        }
        return query;
    }
    stripQueryString(uri) {
        const queryIndex = uri.indexOf('?');
        return queryIndex !== -1 ? uri.substring(0, queryIndex) : uri;
    }
    generateInteractionId(request, index) {
        const method = request.method;
        const path = request.uri.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        return `${method}_${path}_${index}`;
    }
    estimateInteractionLine(interaction, index, lineOffsets) {
        const request = interaction.request || interaction;
        const method = request.method;
        const uri = request.uri || request.url;
        if (method && uri) {
            const searchPatterns = [
                `method:\\s*["']?${method}`,
                `uri:\\s*["']?${uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
                `${method}\\s+${uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
            ];
            for (const pattern of searchPatterns) {
                try {
                    const regex = new RegExp(pattern, 'gi');
                    let match;
                    let lastIndex = 0;
                    const matches = [];
                    while ((match = regex.exec(this.rawContent)) !== null) {
                        matches.push(match.index);
                        if (matches.length > index)
                            break;
                    }
                    if (matches.length > index) {
                        return this.findLineNumber(matches[index], lineOffsets);
                    }
                    if (matches.length > 0) {
                        return this.findLineNumber(matches[0], lineOffsets);
                    }
                }
                catch {
                }
            }
        }
        const interactionsPattern = /^(\s*)-\s*(request|method|uri|url):/gm;
        let match;
        let count = 0;
        while ((match = interactionsPattern.exec(this.rawContent)) !== null) {
            if (count === index) {
                return this.findLineNumber(match.index, lineOffsets);
            }
            count++;
        }
        return Math.max(1, index * 15 + 3);
    }
    createParseError(error) {
        if (error.name === 'YAMLException') {
            return {
                message: `YAML 解析错误: ${error.message}`,
                line: error.mark?.line,
                column: error.mark?.column,
                code: types_1.ExitCodes.PARSE_ERROR
            };
        }
        if (error instanceof SyntaxError) {
            const match = error.message.match(/position (\d+)/);
            const position = match ? parseInt(match[1]) : 0;
            const lineOffsets = this.getLineOffsets();
            return {
                message: `JSON 解析错误: ${error.message}`,
                line: this.findLineNumber(position, lineOffsets),
                code: types_1.ExitCodes.PARSE_ERROR
            };
        }
        return {
            message: error.message || '未知解析错误',
            code: types_1.ExitCodes.PARSE_ERROR
        };
    }
}
exports.CassetteParser = CassetteParser;
async function parseCassette(filePath) {
    const parser = new CassetteParser(filePath);
    return parser.parse();
}
//# sourceMappingURL=cassette-parser.js.map