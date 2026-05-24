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
exports.SourcemapScanner = void 0;
exports.createScanner = createScanner;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const utils_1 = require("./utils");
const parser_1 = require("./parser");
const exceptions_1 = require("./exceptions");
class SourcemapScanner {
    constructor(options, exceptionLoader) {
        this.startTime = 0;
        this.options = options;
        this.exceptionLoader = exceptionLoader;
    }
    async scan() {
        this.startTime = Date.now();
        const files = await this.collectFiles();
        const results = [];
        const allIssues = [];
        for (const file of files) {
            const result = await this.scanFile(file);
            results.push(result);
            allIssues.push(...result.issues);
        }
        const expiredExceptions = this.exceptionLoader.getExpiredRules();
        for (const rule of expiredExceptions) {
            const issue = this.createExpiredExceptionIssue(rule);
            allIssues.push(issue);
        }
        const summary = this.createSummary(results, allIssues, expiredExceptions);
        return {
            metadata: {
                version: this.getVersion(),
                timestamp: new Date().toISOString(),
                cliOptions: this.options,
            },
            summary,
            results,
            issues: allIssues,
            exceptions: {
                active: this.exceptionLoader.getActiveRules(),
                expired: expiredExceptions,
            },
        };
    }
    async collectFiles() {
        const targets = this.getScanTargets();
        const files = new Set();
        for (const target of targets) {
            const stat = await fs.promises.stat(target);
            if (stat.isDirectory()) {
                const matchedFiles = await (0, glob_1.glob)('**/*.{js,mjs,cjs,map}', {
                    cwd: target,
                    absolute: true,
                    nodir: true,
                    ignore: ['**/node_modules/**'],
                });
                matchedFiles.forEach(f => files.add(f));
            }
            else if (stat.isFile()) {
                if ((0, utils_1.isJsFile)(target) || (0, utils_1.isSourcemapFile)(target)) {
                    files.add(target);
                }
            }
        }
        return Array.from(files);
    }
    getScanTargets() {
        const targets = [];
        if (this.options.dist) {
            targets.push(path.resolve(this.options.dist));
        }
        if (this.options.sourcemap) {
            targets.push(path.resolve(this.options.sourcemap));
        }
        if (this.options.js) {
            targets.push(path.resolve(this.options.js));
        }
        return [...new Set(targets)];
    }
    async scanFile(filePath) {
        const normalizedPath = (0, utils_1.normalizeFilePath)(filePath);
        const fileType = (0, utils_1.isSourcemapFile)(filePath) ? 'map' : (0, utils_1.isJsFile)(filePath) ? 'js' : 'other';
        const isExcluded = this.exceptionLoader.isPathExcluded(filePath);
        const exceptionRule = this.exceptionLoader.getMatchingRule(filePath);
        const references = [];
        const issues = [];
        if (fileType === 'js') {
            const refs = await (0, parser_1.parseFile)(filePath);
            references.push(...refs);
            for (const ref of refs) {
                if (!isExcluded) {
                    issues.push(this.createReferenceIssue(filePath, ref));
                }
                if (ref.type !== 'inline') {
                    const resolvedPath = (0, parser_1.resolveSourcemapPath)(filePath, ref.value);
                    const publicUrl = this.getPublicUrl(resolvedPath);
                    if (publicUrl && !isExcluded) {
                        issues.push(this.createPublicAccessIssue(filePath, ref, publicUrl));
                    }
                }
            }
        }
        if (fileType === 'map' && !isExcluded) {
            const isValid = await (0, parser_1.checkSourcemapValidity)(filePath);
            if (isValid) {
                issues.push(this.createSourcemapFileIssue(filePath));
            }
            const publicUrl = this.getPublicUrl(filePath);
            if (publicUrl) {
                issues.push(this.createPublicMapFileIssue(filePath, publicUrl));
            }
        }
        return {
            filePath: normalizedPath,
            fileType,
            references,
            issues,
            isExcluded,
            exceptionRule,
        };
    }
    createSourcemapFileIssue(filePath) {
        const relPath = this.getRelativePath(filePath);
        return {
            id: (0, utils_1.generateId)('sourcemap_file', filePath),
            severity: 'critical',
            type: 'sourcemap_file',
            file: relPath,
            message: `发现 sourcemap 文件: ${relPath}`,
            details: {
                suggestedFix: '删除 sourcemap 文件或配置构建工具不生成 sourcemap',
            },
        };
    }
    createReferenceIssue(filePath, ref) {
        const relPath = this.getRelativePath(filePath);
        const severity = ref.type === 'inline' ? 'high' : ref.type === 'hidden' ? 'critical' : 'high';
        return {
            id: (0, utils_1.generateId)('reference', filePath, String(ref.line), String(ref.column)),
            severity,
            type: ref.type === 'hidden' ? 'hidden_sourcemap' : 'sourcemap_reference',
            file: relPath,
            line: ref.line,
            column: ref.column,
            message: `发现 ${this.getReferenceTypeName(ref.type)}: "${ref.value.substring(0, 50)}${ref.value.length > 50 ? '...' : ''}"`,
            details: {
                reference: ref,
                suggestedFix: this.getSuggestedFixForReference(ref),
            },
        };
    }
    createPublicAccessIssue(filePath, ref, publicUrl) {
        const relPath = this.getRelativePath(filePath);
        return {
            id: (0, utils_1.generateId)('public_access', filePath, publicUrl),
            severity: 'critical',
            type: 'publicly_accessible',
            file: relPath,
            line: ref.line,
            column: ref.column,
            message: `Sourcemap 可能公开可访问: ${publicUrl}`,
            details: {
                reference: ref,
                publicUrl,
                suggestedFix: '确保 sourcemap 文件不会被公开访问，或从构建产物中移除',
            },
        };
    }
    createPublicMapFileIssue(filePath, publicUrl) {
        const relPath = this.getRelativePath(filePath);
        return {
            id: (0, utils_1.generateId)('public_map', filePath),
            severity: 'critical',
            type: 'publicly_accessible',
            file: relPath,
            message: `Sourcemap 文件公开可访问: ${publicUrl}`,
            details: {
                publicUrl,
                suggestedFix: '从 Web 服务器配置中禁止 .map 文件访问，或删除 sourcemap 文件',
            },
        };
    }
    createExpiredExceptionIssue(rule) {
        return {
            id: (0, utils_1.generateId)('expired_exception', rule.path, rule.expiresAt || ''),
            severity: 'medium',
            type: 'expired_exception',
            file: rule.path,
            message: `例外规则已过期: ${rule.path}`,
            details: {
                exception: rule,
                suggestedFix: '更新例外规则的过期时间，或移除该例外并修复问题',
            },
        };
    }
    getReferenceTypeName(type) {
        const names = {
            comment: 'sourcemap 注释引用',
            hidden: '隐藏的 sourcemap 引用',
            url: 'sourcemap URL 引用',
            inline: '内联 sourcemap',
        };
        return names[type] || type;
    }
    getSuggestedFixForReference(ref) {
        switch (ref.type) {
            case 'inline':
                return '移除内联 sourcemap，配置构建工具生成独立文件并确保不公开';
            case 'hidden':
                return '检查代码中隐藏的 sourcemap 引用，可能在字符串或变量中';
            default:
                return '移除 sourceMappingURL 注释，或确保引用的 sourcemap 不公开';
        }
    }
    getPublicUrl(filePath) {
        if (!this.options.publicPath)
            return null;
        const baseDir = this.options.dist || process.cwd();
        const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
        if (relPath.startsWith('..'))
            return null;
        return (0, utils_1.joinPublicPath)(this.options.publicPath, relPath);
    }
    getRelativePath(filePath) {
        const baseDir = this.options.dist || process.cwd();
        const relPath = path.relative(baseDir, filePath);
        return relPath.replace(/\\/g, '/');
    }
    createSummary(results, issues, expiredExceptions) {
        const duration = Date.now() - this.startTime;
        return {
            totalFiles: results.length,
            scannedFiles: results.filter(r => !r.isExcluded).length,
            excludedFiles: results.filter(r => r.isExcluded).length,
            criticalIssues: issues.filter(i => i.severity === 'critical').length,
            highIssues: issues.filter(i => i.severity === 'high').length,
            mediumIssues: issues.filter(i => i.severity === 'medium').length,
            lowIssues: issues.filter(i => i.severity === 'low').length,
            expiredExceptions: expiredExceptions.length,
            scanDuration: duration,
            scanTimestamp: new Date().toISOString(),
        };
    }
    getVersion() {
        try {
            const pkgPath = path.resolve(__dirname, '../package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            return pkg.version || '1.0.0';
        }
        catch {
            return '1.0.0';
        }
    }
}
exports.SourcemapScanner = SourcemapScanner;
async function createScanner(options) {
    const exceptionLoader = new exceptions_1.ExceptionLoader(options.exceptions);
    await exceptionLoader.load();
    return new SourcemapScanner(options, exceptionLoader);
}
//# sourceMappingURL=scanner.js.map