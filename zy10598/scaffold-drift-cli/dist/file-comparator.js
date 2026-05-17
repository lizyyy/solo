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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileComparator = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const diff = __importStar(require("diff"));
const minimatch_1 = require("minimatch");
class FileComparator {
    async compare(repoPath, templatePath, fileEntry, templateContent) {
        const repoFilePath = path_1.default.join(repoPath, fileEntry.path);
        const exists = await fs_extra_1.default.pathExists(repoFilePath);
        const result = {
            path: fileEntry.path,
            exists,
            required: fileEntry.required,
            drifts: []
        };
        if (!exists) {
            if (fileEntry.required) {
                result.drifts.push({
                    id: this.generateId(),
                    type: 'file_missing',
                    path: fileEntry.path,
                    status: 'risk',
                    description: `必需文件缺失: ${fileEntry.path}`,
                    severity: 'high',
                    reason: '模板要求此文件必须存在'
                });
            }
            return result;
        }
        if (fileEntry.checkContent && templateContent) {
            try {
                const repoContent = await fs_extra_1.default.readFile(repoFilePath, 'utf-8');
                const contentMatch = this.isContentMatch(repoContent, templateContent, fileEntry.ignorePatterns || []);
                result.contentMatch = contentMatch;
                if (!contentMatch) {
                    const diffChunks = this.generateDiff(repoContent, templateContent);
                    result.drifts.push({
                        id: this.generateId(),
                        type: 'content_diff',
                        path: fileEntry.path,
                        status: 'risk',
                        description: `文件内容与模板存在差异: ${fileEntry.path}`,
                        severity: 'medium',
                        reason: '文件内容已偏离模板',
                        diff: diffChunks,
                        expected: templateContent.substring(0, 500) + (templateContent.length > 500 ? '...' : ''),
                        actual: repoContent.substring(0, 500) + (repoContent.length > 500 ? '...' : '')
                    });
                }
            }
            catch (error) {
                if (error.code === 'EACCES' || error.code === 'EPERM') {
                    result.drifts.push({
                        id: this.generateId(),
                        type: 'permission_denied',
                        path: fileEntry.path,
                        status: 'unknown',
                        description: `无法读取文件: ${fileEntry.path}`,
                        severity: 'low',
                        reason: '权限不足'
                    });
                }
                else {
                    result.drifts.push({
                        id: this.generateId(),
                        type: 'parse_error',
                        path: fileEntry.path,
                        status: 'unknown',
                        description: `读取文件时出错: ${fileEntry.path}`,
                        severity: 'low',
                        reason: error.message
                    });
                }
            }
        }
        return result;
    }
    isContentMatch(repoContent, templateContent, ignorePatterns) {
        let repoLines = repoContent.split('\n');
        let templateLines = templateContent.split('\n');
        for (const pattern of ignorePatterns) {
            repoLines = repoLines.filter(line => !(0, minimatch_1.minimatch)(line, pattern, { matchBase: true, nocase: true }));
            templateLines = templateLines.filter(line => !(0, minimatch_1.minimatch)(line, pattern, { matchBase: true, nocase: true }));
        }
        return repoLines.join('\n').trim() === templateLines.join('\n').trim();
    }
    generateDiff(actual, expected) {
        const diffResult = diff.diffLines(expected, actual);
        const chunks = [];
        let lineCount = 1;
        for (const part of diffResult) {
            const chunk = {
                type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
                content: part.value,
                lineStart: lineCount
            };
            const lines = part.value.split('\n').length - 1;
            lineCount += lines;
            chunk.lineEnd = lineCount - 1;
            chunks.push(chunk);
        }
        return chunks;
    }
    generateId() {
        return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.FileComparator = FileComparator;
