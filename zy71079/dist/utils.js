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
exports.generateId = generateId;
exports.normalizeFilePath = normalizeFilePath;
exports.isExpired = isExpired;
exports.formatDate = formatDate;
exports.formatDuration = formatDuration;
exports.matchesGlobPattern = matchesGlobPattern;
exports.getFileExtension = getFileExtension;
exports.isJsFile = isJsFile;
exports.isSourcemapFile = isSourcemapFile;
exports.ensureTrailingSlash = ensureTrailingSlash;
exports.joinPublicPath = joinPublicPath;
exports.truncateString = truncateString;
exports.pluralize = pluralize;
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
function generateId(...parts) {
    const input = parts.join('|');
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}
function normalizeFilePath(filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
}
function isExpired(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    return date < now;
}
function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}
function matchesGlobPattern(filePath, pattern) {
    const normalizedPath = normalizeFilePath(filePath);
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '%%DOUBLE_STAR%%')
        .replace(/\*/g, '[^/]*')
        .replace(/%%DOUBLE_STAR%%/g, '.*')
        .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedPath);
}
function getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
}
function isJsFile(filePath) {
    const ext = getFileExtension(filePath);
    return ext === '.js' || ext === '.mjs' || ext === '.cjs';
}
function isSourcemapFile(filePath) {
    const ext = getFileExtension(filePath);
    return ext === '.map';
}
function ensureTrailingSlash(str) {
    return str.endsWith('/') ? str : `${str}/`;
}
function joinPublicPath(base, ...parts) {
    const normalizedBase = ensureTrailingSlash(base);
    const normalizedParts = parts.map(p => p.replace(/^\//, ''));
    return normalizedBase + normalizedParts.join('/');
}
function truncateString(str, maxLength = 100) {
    if (str.length <= maxLength)
        return str;
    return `${str.slice(0, maxLength - 3)}...`;
}
function pluralize(count, singular, plural) {
    if (count === 1)
        return singular;
    return plural || `${singular}s`;
}
//# sourceMappingURL=utils.js.map