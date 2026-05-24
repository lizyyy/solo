"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestSigner = void 0;
exports.createRequestSigner = createRequestSigner;
exports.calculateSimilarity = calculateSimilarity;
exports.findBestMatch = findBestMatch;
const crypto_1 = require("crypto");
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
class RequestSigner {
    constructor(config) {
        this.pathPatterns = [];
        this.config = config;
        this.compilePathPatterns();
    }
    compilePathPatterns() {
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        const numberPattern = /\/\d+(?=\/|$)/g;
        const idPattern = /[_-]id_\d+/g;
        this.pathPatterns = [uuidPattern, numberPattern, idPattern];
    }
    sign(request) {
        const method = request.method.toUpperCase();
        const path = request.uri;
        const normalizedPath = this.normalizePath(path);
        const queryHash = this.hashQuery(request.query || {});
        const bodyHash = this.hashBody(request.body);
        const headersHash = this.hashHeaders(request.headers);
        const signatureData = {
            method,
            normalizedPath,
            queryHash,
            bodyHash,
            headersHash
        };
        const fullHash = this.hash((0, json_stable_stringify_1.default)(signatureData) || '');
        return {
            id: `${method}_${normalizedPath}_${fullHash.substring(0, 8)}`,
            method,
            path,
            normalizedPath,
            queryHash,
            bodyHash,
            headersHash,
            fullHash
        };
    }
    normalizePath(path) {
        let normalized = path;
        for (const pattern of this.pathPatterns) {
            normalized = normalized.replace(pattern, '/{var}');
        }
        return normalized;
    }
    hashQuery(query) {
        const filteredQuery = {};
        for (const [key, value] of Object.entries(query)) {
            if (this.shouldIgnoreField(`query.${key}`)) {
                continue;
            }
            filteredQuery[key] = this.normalizeQueryValue(value);
        }
        if (Object.keys(filteredQuery).length === 0) {
            return 'empty';
        }
        return this.hash((0, json_stable_stringify_1.default)(filteredQuery) || '');
    }
    normalizeQueryValue(value) {
        if (Array.isArray(value)) {
            return value.sort().map(v => this.maskValue(v));
        }
        return this.maskValue(value);
    }
    hashBody(body) {
        if (body === undefined || body === null) {
            return 'empty';
        }
        const normalizedBody = this.normalizeValue(body, 'body');
        if (this.isEmptyValue(normalizedBody)) {
            return 'empty';
        }
        return this.hash((0, json_stable_stringify_1.default)(normalizedBody) || '');
    }
    hashHeaders(headers) {
        if (!this.config.normalizeHeaders) {
            return 'ignored';
        }
        const significantHeaders = [
            'content-type',
            'accept',
            'authorization',
            'x-request-id'
        ];
        const filteredHeaders = {};
        for (const header of significantHeaders) {
            const value = headers[header];
            if (value !== undefined && !this.shouldIgnoreField(`header.${header}`)) {
                filteredHeaders[header] = this.normalizeHeaderValue(value);
            }
        }
        if (Object.keys(filteredHeaders).length === 0) {
            return 'empty';
        }
        return this.hash((0, json_stable_stringify_1.default)(filteredHeaders) || '');
    }
    normalizeHeaderValue(value) {
        if (Array.isArray(value)) {
            return value.map(v => this.maskValue(v));
        }
        return this.maskValue(value);
    }
    normalizeValue(value, prefix = '') {
        if (value === null || value === undefined) {
            return value;
        }
        if (this.shouldIgnoreField(prefix)) {
            return '__IGNORED__';
        }
        if (typeof value === 'string') {
            return this.maskValue(value);
        }
        if (Array.isArray(value)) {
            const result = value.map((item, index) => this.normalizeValue(item, `${prefix}[${index}]`));
            return this.config.ignoreOrder ? this.sortArray(result) : result;
        }
        if (typeof value === 'object') {
            const result = {};
            for (const [key, val] of Object.entries(value)) {
                const fieldPath = prefix ? `${prefix}.${key}` : key;
                if (!this.shouldIgnoreField(fieldPath)) {
                    result[key] = this.normalizeValue(val, fieldPath);
                }
            }
            return result;
        }
        return value;
    }
    maskValue(str) {
        for (const rule of this.config.maskingRules) {
            if (rule.pattern && rule.replacement) {
                try {
                    const regex = new RegExp(rule.pattern, 'g');
                    str = str.replace(regex, rule.replacement);
                }
                catch {
                }
            }
        }
        return str;
    }
    shouldIgnoreField(fieldPath) {
        for (const ignoreField of this.config.ignoreFields) {
            if (this.matchFieldPattern(fieldPath, ignoreField)) {
                return true;
            }
        }
        return false;
    }
    matchFieldPattern(fieldPath, pattern) {
        if (pattern === fieldPath) {
            return true;
        }
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        try {
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(fieldPath);
        }
        catch {
            return false;
        }
    }
    sortArray(arr) {
        return [...arr].sort((a, b) => {
            const strA = (typeof a === 'string' ? a : (0, json_stable_stringify_1.default)(a)) || '';
            const strB = (typeof b === 'string' ? b : (0, json_stable_stringify_1.default)(b)) || '';
            return strA.localeCompare(strB);
        });
    }
    isEmptyValue(value) {
        if (value === null || value === undefined)
            return true;
        if (typeof value === 'string' && value === '')
            return true;
        if (Array.isArray(value) && value.length === 0)
            return true;
        if (typeof value === 'object' && Object.keys(value).length === 0)
            return true;
        return false;
    }
    hash(str) {
        return (0, crypto_1.createHash)('sha256').update(str).digest('hex');
    }
}
exports.RequestSigner = RequestSigner;
function createRequestSigner(config) {
    return new RequestSigner(config);
}
function calculateSimilarity(sig1, sig2) {
    let score = 0;
    const total = 4;
    if (sig1.method === sig2.method)
        score++;
    if (sig1.normalizedPath === sig2.normalizedPath)
        score++;
    if (sig1.queryHash === sig2.queryHash)
        score++;
    if (sig1.bodyHash === sig2.bodyHash)
        score++;
    return score / total;
}
function findBestMatch(target, candidates, threshold = 0.5) {
    let bestMatch = null;
    for (const candidate of candidates) {
        const score = calculateSimilarity(target, candidate);
        if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { signature: candidate, score };
        }
    }
    return bestMatch;
}
//# sourceMappingURL=request-signer.js.map