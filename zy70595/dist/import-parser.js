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
exports.ImportParser = void 0;
const fs = __importStar(require("fs"));
class ImportParser {
    parseFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseContent(content, filePath);
    }
    parseContent(content, sourceFile) {
        const lines = content.split('\n');
        const imports = [];
        const dirtyLines = [];
        let inMultilineComment = false;
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const rawLine = lines[i];
            if (this.isBlankOrComment(rawLine, inMultilineComment)) {
                inMultilineComment = this.updateMultilineCommentState(rawLine, inMultilineComment);
                continue;
            }
            inMultilineComment = this.updateMultilineCommentState(rawLine, inMultilineComment);
            const parseResult = this.parseImportLine(rawLine, lineNumber);
            if (parseResult.isDirty) {
                dirtyLines.push({
                    lineNumber,
                    rawLine,
                    reason: parseResult.reason,
                    category: parseResult.category,
                });
            }
            else if ('import' in parseResult) {
                imports.push(parseResult.import);
            }
        }
        return { imports, dirtyLines };
    }
    isBlankOrComment(line, inMultilineComment) {
        const trimmed = line.trim();
        if (inMultilineComment)
            return true;
        if (trimmed === '')
            return true;
        if (trimmed.startsWith('//'))
            return true;
        return false;
    }
    updateMultilineCommentState(line, currentState) {
        const hasStart = line.includes('/*');
        const hasEnd = line.includes('*/');
        if (hasStart && hasEnd) {
            const startIndex = line.indexOf('/*');
            const endIndex = line.indexOf('*/');
            if (startIndex < endIndex) {
                return currentState;
            }
        }
        if (hasStart)
            return true;
        if (hasEnd)
            return false;
        return currentState;
    }
    parseImportLine(rawLine, lineNumber) {
        const trimmed = rawLine.trim();
        if (!trimmed.toLowerCase().startsWith('import')) {
            return { isDirty: false };
        }
        try {
            const isTypeImport = trimmed.includes('import type');
            const importPath = this.extractImportPath(trimmed);
            if (!importPath) {
                return {
                    isDirty: true,
                    reason: 'Could not extract import path from import statement',
                    category: 'parse_error',
                };
            }
            return {
                isDirty: false,
                import: {
                    lineNumber,
                    rawLine,
                    importPath,
                    isTypeImport,
                },
            };
        }
        catch (error) {
            return {
                isDirty: true,
                reason: error instanceof Error ? error.message : 'Unknown parse error',
                category: 'parse_error',
            };
        }
    }
    extractImportPath(line) {
        const patterns = [
            /from\s+['"]([^'"]+)['"]/,
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
        ];
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    parseImportList(content) {
        const lines = content.split('\n');
        const imports = [];
        const dirtyLines = [];
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const rawLine = lines[i].trim();
            if (rawLine === '')
                continue;
            if (this.isValidImportPath(rawLine)) {
                imports.push(rawLine);
            }
            else {
                dirtyLines.push({
                    lineNumber,
                    rawLine: lines[i],
                    reason: 'Invalid import path format',
                    category: 'invalid_format',
                });
            }
        }
        return { imports, dirtyLines };
    }
    isValidImportPath(path) {
        if (path.includes("'") || path.includes('"'))
            return false;
        if (path.includes(' '))
            return false;
        if (path.length === 0)
            return false;
        return true;
    }
}
exports.ImportParser = ImportParser;
