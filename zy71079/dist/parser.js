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
exports.findLineAndColumn = findLineAndColumn;
exports.parseSourcemapReferences = parseSourcemapReferences;
exports.parseFile = parseFile;
exports.resolveSourcemapPath = resolveSourcemapPath;
exports.isValidSourcemap = isValidSourcemap;
exports.checkSourcemapValidity = checkSourcemapValidity;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SOURCEMAP_PATTERNS = [
    {
        type: 'comment',
        pattern: /\/\/#\s*sourceMappingURL\s*=\s*(\S+)/g,
        groupIndex: 1,
    },
    {
        type: 'comment',
        pattern: /\/\/@\s*sourceMappingURL\s*=\s*(\S+)/g,
        groupIndex: 1,
    },
    {
        type: 'comment',
        pattern: /\/\*#\s*sourceMappingURL\s*=\s*(\S+)\s*\*\//g,
        groupIndex: 1,
    },
    {
        type: 'hidden',
        pattern: /sourceMappingURL[=:]\s*["']?([^"'\s\)]+)/gi,
        groupIndex: 1,
    },
    {
        type: 'url',
        pattern: /["']([^"']+\.map)["']/g,
        groupIndex: 1,
    },
];
function findLineAndColumn(content, charIndex) {
    const lines = content.slice(0, charIndex).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    };
}
function parseSourcemapReferences(content) {
    const references = [];
    const seen = new Set();
    for (const { type, pattern, groupIndex } of SOURCEMAP_PATTERNS) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
            const value = match[groupIndex];
            const { line, column } = findLineAndColumn(content, match.index);
            const raw = match[0];
            const key = `${type}:${value}:${line}:${column}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            const finalType = value.startsWith('data:') ? 'inline' : type;
            references.push({
                type: finalType,
                value: value.trim(),
                line,
                column,
                raw,
            });
        }
    }
    return references;
}
async function parseFile(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return parseSourcemapReferences(content);
}
function resolveSourcemapPath(jsFilePath, mapPath) {
    if (mapPath.startsWith('http://') || mapPath.startsWith('https://') || mapPath.startsWith('//')) {
        return mapPath;
    }
    if (mapPath.startsWith('data:')) {
        return mapPath;
    }
    return path.resolve(path.dirname(jsFilePath), mapPath);
}
function isValidSourcemap(content) {
    try {
        const parsed = JSON.parse(content);
        return (parsed.version !== undefined &&
            (parsed.sources !== undefined || parsed.mappings !== undefined));
    }
    catch {
        return false;
    }
}
async function checkSourcemapValidity(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return isValidSourcemap(content);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=parser.js.map