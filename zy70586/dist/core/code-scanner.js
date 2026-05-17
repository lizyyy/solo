"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeScanner = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
class CodeScanner {
    constructor() {
        this.badSamples = [];
        this.flagPatterns = [];
    }
    async scanDirectory(sourceDir, flags, filePatterns, excludePatterns) {
        this.flagPatterns = flags.map(flag => new RegExp(`\\b${flag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'));
        const files = await this.findFiles(sourceDir, filePatterns, excludePatterns);
        const allReferences = [];
        const allDeadBranches = [];
        const flagMap = new Map(flags.map(f => [f.name, f]));
        for (const file of files) {
            try {
                const { references, deadBranches } = await this.scanFile(file, flags, flagMap);
                allReferences.push(...references);
                allDeadBranches.push(...deadBranches);
            }
            catch (error) {
                this.badSamples.push({
                    filePath: file,
                    reason: error instanceof Error ? error.message : '文件扫描失败',
                    errorType: 'parse-error',
                    rawContent: error instanceof Error ? error.stack : undefined
                });
            }
        }
        return {
            references: allReferences,
            deadBranches: allDeadBranches,
            badSamples: this.badSamples,
            filesScanned: files.length
        };
    }
    async findFiles(sourceDir, filePatterns, excludePatterns) {
        const files = [];
        for (const pattern of filePatterns) {
            const matches = await (0, glob_1.glob)(pattern, {
                cwd: sourceDir,
                ignore: excludePatterns,
                nodir: true,
                absolute: true
            });
            files.push(...matches);
        }
        return [...new Set(files)];
    }
    async scanFile(filePath, flags, flagMap) {
        const references = [];
        const deadBranches = [];
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path_1.default.relative(process.cwd(), filePath);
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            for (const flag of flags) {
                const flagPattern = new RegExp(`\\b${flag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
                let match;
                while ((match = flagPattern.exec(line)) !== null) {
                    const column = match.index + 1;
                    const context = this.extractContext(lines, lineIndex);
                    const contextType = this.detectContextType(context);
                    const reference = {
                        flagName: flag.name,
                        filePath: relativePath,
                        lineNumber: lineIndex + 1,
                        column,
                        context,
                        contextType,
                        rawCode: line.trim()
                    };
                    references.push(reference);
                    const deadBranch = this.analyzeDeadBranch(reference, flag, lines, lineIndex);
                    if (deadBranch) {
                        deadBranches.push(deadBranch);
                    }
                }
            }
        }
        return { references, deadBranches };
    }
    extractContext(lines, lineIndex) {
        const start = Math.max(0, lineIndex - 2);
        const end = Math.min(lines.length - 1, lineIndex + 2);
        return lines.slice(start, end + 1).join('\n');
    }
    detectContextType(context) {
        if (/^\s*if\s*\(/.test(context))
            return 'if';
        if (/^\s*else/.test(context))
            return 'else';
        if (/\?.*:/.test(context))
            return 'ternary';
        if (/\w+\s*\(/.test(context))
            return 'function-call';
        return 'other';
    }
    analyzeDeadBranch(reference, flag, lines, lineIndex) {
        const { contextType, filePath, lineNumber, column, flagName, rawCode } = reference;
        const { defaultValue } = flag;
        let branchType = null;
        let suggestion = '';
        let confidence = 'medium';
        switch (contextType) {
            case 'if': {
                const isNegated = this.isNegated(rawCode, flagName);
                const effectiveValue = isNegated ? !defaultValue : defaultValue;
                if (effectiveValue) {
                    branchType = 'false-branch';
                    suggestion = '可以删除 else 分支，保留 if 内代码，移除 if 条件判断';
                    confidence = 'high';
                }
                else {
                    branchType = 'true-branch';
                    suggestion = '可以删除 if 内代码，保留 else 分支，或直接移除整个条件';
                    confidence = 'high';
                }
                break;
            }
            case 'ternary': {
                const isNegated = this.isNegated(rawCode, flagName);
                const effectiveValue = isNegated ? !defaultValue : defaultValue;
                if (effectiveValue) {
                    branchType = 'false-branch';
                    suggestion = '可以简化三元表达式，直接使用冒号前的表达式结果';
                    confidence = 'high';
                }
                else {
                    branchType = 'true-branch';
                    suggestion = '可以简化三元表达式，直接使用冒号后的表达式结果';
                    confidence = 'high';
                }
                break;
            }
            case 'else': {
                break;
            }
            default: {
                branchType = 'entire-condition';
                suggestion = defaultValue
                    ? '该开关默认为 true，可以考虑移除该条件判断'
                    : '该开关默认为 false，可以考虑移除该条件判断';
                confidence = 'low';
            }
        }
        if (!branchType)
            return null;
        return {
            flagName,
            filePath,
            lineNumber,
            column,
            branchType,
            defaultValue,
            context: this.extractContext(lines, lineIndex),
            suggestion,
            rawCode,
            confidence
        };
    }
    isNegated(code, flagName) {
        const escapedFlag = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const negationPattern = new RegExp(`!\\s*\\b${escapedFlag}\\b`);
        const notPattern = new RegExp(`not\\s+${escapedFlag}\\b`, 'i');
        return negationPattern.test(code) || notPattern.test(code);
    }
}
exports.CodeScanner = CodeScanner;
//# sourceMappingURL=code-scanner.js.map