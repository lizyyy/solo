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
exports.SourceScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SourceScanner {
    constructor() {
        this.badEntries = [];
        this.enums = [];
    }
    scanFiles(filePaths) {
        this.badEntries = [];
        this.enums = [];
        for (const filePath of filePaths) {
            try {
                if (fs.statSync(filePath).isDirectory()) {
                    this.scanDirectory(filePath);
                }
                else {
                    this.scanFile(filePath);
                }
            }
            catch (e) {
                this.addBadEntry(filePath, undefined, undefined, '', `扫描失败: ${e.message}`);
            }
        }
        return { enums: this.enums, badEntries: this.badEntries };
    }
    scanDirectory(dirPath) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    this.scanDirectory(fullPath);
                }
                else if (this.isSourceFile(file)) {
                    this.scanFile(fullPath);
                }
            }
            catch (e) {
                this.addBadEntry(fullPath, undefined, undefined, '', `目录扫描失败: ${e.message}`);
            }
        }
    }
    isSourceFile(fileName) {
        return /\.(ts|tsx|js|jsx|java|py|go)$/.test(fileName);
    }
    scanFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.ts' || ext === '.tsx') {
                this.extractTypeScriptEnums(content, lines, filePath);
                this.extractJavaScriptEnums(content, lines, filePath);
            }
            else if (ext === '.js' || ext === '.jsx') {
                this.extractJavaScriptEnums(content, lines, filePath);
            }
            else if (ext === '.py') {
                this.extractPythonEnums(content, lines, filePath);
            }
            else if (ext === '.java') {
                this.extractJavaEnums(content, lines, filePath);
            }
            else if (ext === '.go') {
                this.extractGoEnums(content, lines, filePath);
            }
        }
        catch (e) {
            this.addBadEntry(filePath, undefined, undefined, '', `文件读取失败: ${e.message}`);
        }
    }
    extractTypeScriptEnums(content, lines, filePath) {
        const enumRegex = /\benum\s+(\w+)\s*{([^}]*)}/g;
        let match;
        while ((match = enumRegex.exec(content)) !== null) {
            const enumName = match[1];
            const enumBody = match[2];
            const lineNum = this.getLineNumber(content, match.index);
            const values = this.parseEnumValues(enumBody, lineNum, lines, filePath);
            this.addEnumDefinition(enumName, values, filePath, match[0]);
        }
    }
    extractJavaScriptEnums(content, lines, filePath) {
        const constEnumRegex = /(?:^|\n)\s*const\s+(\w+)\s*=\s*{([^}]*)}/g;
        let match;
        while ((match = constEnumRegex.exec(content)) !== null) {
            const enumName = match[1];
            const enumBody = match[2];
            if (enumBody.includes(':') && this.looksLikeEnum(enumBody)) {
                const lineNum = this.getLineNumber(content, match.index);
                const values = this.parseObjectEnumValues(enumBody, lineNum, lines, filePath);
                if (values.length > 0) {
                    this.addEnumDefinition(enumName, values, filePath, match[0]);
                }
            }
        }
    }
    extractPythonEnums(content, lines, filePath) {
        const classEnumRegex = /class\s+(\w+)\s*\(\s*Enum\s*\):\s*\n((?:\s+\w+\s*=.*\n)*)/g;
        let match;
        while ((match = classEnumRegex.exec(content)) !== null) {
            const enumName = match[1];
            const enumBody = match[2];
            const lineNum = this.getLineNumber(content, match.index);
            const values = this.parsePythonEnumValues(enumBody, lineNum, lines, filePath);
            this.addEnumDefinition(enumName, values, filePath, match[0]);
        }
    }
    extractJavaEnums(content, lines, filePath) {
        const enumRegex = /\benum\s+(\w+)\s*{([^}]*)}/g;
        let match;
        while ((match = enumRegex.exec(content)) !== null) {
            const enumName = match[1];
            const enumBody = match[2];
            const lineNum = this.getLineNumber(content, match.index);
            const values = this.parseJavaEnumValues(enumBody, lineNum, lines, filePath);
            this.addEnumDefinition(enumName, values, filePath, match[0]);
        }
    }
    extractGoEnums(content, lines, filePath) {
        const constBlockRegex = /const\s*\(\s*\n((?:\s+\w+\s+\w+\s*=.*\n)*)\s*\)/g;
        let match;
        while ((match = constBlockRegex.exec(content)) !== null) {
            const constBody = match[1];
            const lineNum = this.getLineNumber(content, match.index);
            const values = this.parseGoConstValues(constBody, lineNum, lines, filePath);
            const typeMatch = constBody.match(/\w+\s+(\w+)\s*=/);
            if (typeMatch && values.length > 0) {
                this.addEnumDefinition(typeMatch[1], values, filePath, match[0]);
            }
        }
    }
    parseEnumValues(enumBody, startLine, lines, filePath) {
        const values = [];
        const seenKeys = new Set();
        const valueRegex = /(?:^|,|\n)\s*(\w+)(?:\s*=\s*([^,\n]+))?/g;
        let match;
        while ((match = valueRegex.exec(enumBody)) !== null) {
            const key = match[1];
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            const value = match[2] ? match[2].trim() : key;
            const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
            values.push({
                value: this.normalizeValue(value),
                source: 'source',
                line: lineNum,
                column: match.index + 1
            });
        }
        return values;
    }
    parseObjectEnumValues(enumBody, startLine, lines, filePath) {
        const values = [];
        const valueRegex = /(\w+)\s*:\s*([^,\n]+)/g;
        let match;
        while ((match = valueRegex.exec(enumBody)) !== null) {
            const value = match[2].trim();
            const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
            values.push({
                value: this.normalizeValue(value),
                source: 'source',
                line: lineNum,
                column: match.index + 1
            });
        }
        return values;
    }
    parsePythonEnumValues(enumBody, startLine, lines, filePath) {
        const values = [];
        const valueRegex = /(\w+)\s*=\s*(.+)/g;
        let match;
        while ((match = valueRegex.exec(enumBody)) !== null) {
            const value = match[2].trim();
            const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index)) + 1;
            values.push({
                value: this.normalizeValue(value),
                source: 'source',
                line: lineNum,
                column: match.index + 1
            });
        }
        return values;
    }
    parseJavaEnumValues(enumBody, startLine, lines, filePath) {
        const values = [];
        const valueRegex = /(\w+)(?:\([^)]*\))?/g;
        let match;
        while ((match = valueRegex.exec(enumBody)) !== null) {
            const value = match[1].trim();
            if (value && !['public', 'private', 'protected', 'static', 'final'].includes(value)) {
                const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
                values.push({
                    value: value,
                    source: 'source',
                    line: lineNum,
                    column: match.index + 1
                });
            }
        }
        return values;
    }
    parseGoConstValues(enumBody, startLine, lines, filePath) {
        const values = [];
        const valueRegex = /(\w+)\s+\w+\s*=\s*(.+)/g;
        let match;
        while ((match = valueRegex.exec(enumBody)) !== null) {
            const value = match[2].trim();
            const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index)) + 1;
            values.push({
                value: this.normalizeValue(value),
                source: 'source',
                line: lineNum,
                column: match.index + 1
            });
        }
        return values;
    }
    normalizeValue(value) {
        const trimmed = value.trim();
        if (/^['"].*['"]$/.test(trimmed)) {
            return trimmed.slice(1, -1);
        }
        if (/^-?\d+\.?\d*$/.test(trimmed)) {
            return Number(trimmed);
        }
        return trimmed;
    }
    looksLikeEnum(body) {
        return body.split(',').length >= 2;
    }
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    countNewLines(str) {
        return (str.match(/\n/g) || []).length;
    }
    addEnumDefinition(name, values, filePath, rawContent) {
        this.enums.push({
            name,
            values,
            source: 'source',
            filePath,
            rawContent
        });
    }
    addBadEntry(filePath, line, column, rawContent, reason) {
        this.badEntries.push({
            filePath,
            line,
            column,
            rawContent,
            reason,
            severity: 'error'
        });
    }
}
exports.SourceScanner = SourceScanner;
