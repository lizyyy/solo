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
exports.PathResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const json5_1 = __importDefault(require("json5"));
class PathResolver {
    constructor(tsconfigPath) {
        const tsconfig = this.loadTsConfig(tsconfigPath);
        this.projectRoot = path.dirname(tsconfigPath);
        this.baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
        this.paths = tsconfig.compilerOptions?.paths || {};
    }
    loadTsConfig(tsconfigPath) {
        if (!fs.existsSync(tsconfigPath)) {
            throw new Error(`tsconfig.json not found at: ${tsconfigPath}`);
        }
        const content = fs.readFileSync(tsconfigPath, 'utf-8');
        return json5_1.default.parse(content);
    }
    resolve(importPath, sourceFile) {
        const result = {
            originalPath: importPath,
            resolvedPath: importPath,
            fileExists: false,
        };
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
            result.resolvedPath = this.resolveRelativePath(importPath, sourceFile);
            result.fileExists = this.checkFileExists(result.resolvedPath);
            return result;
        }
        const matchedAlias = this.findMatchingAlias(importPath);
        if (matchedAlias) {
            result.matchedAlias = matchedAlias;
            result.resolvedPath = this.applyAlias(importPath, matchedAlias);
            result.fileExists = this.checkFileExists(result.resolvedPath);
        }
        else {
            result.error = `No matching alias found for: ${importPath}`;
            result.fileExists = false;
        }
        return result;
    }
    findMatchingAlias(importPath) {
        const aliases = Object.keys(this.paths).sort((a, b) => b.length - a.length);
        for (const alias of aliases) {
            const aliasPattern = alias.replace('*', '');
            if (alias.includes('*')) {
                if (importPath.startsWith(aliasPattern)) {
                    return alias;
                }
            }
            else {
                if (importPath === alias || importPath.startsWith(alias + '/')) {
                    return alias;
                }
            }
        }
        return undefined;
    }
    applyAlias(importPath, alias) {
        const aliasPaths = this.paths[alias];
        if (!aliasPaths || aliasPaths.length === 0) {
            return importPath;
        }
        const targetPath = aliasPaths[0];
        let resolvedPath;
        if (alias.includes('*')) {
            const aliasPrefix = alias.replace('*', '');
            const wildcardPart = importPath.slice(aliasPrefix.length);
            resolvedPath = targetPath.replace('*', wildcardPart);
        }
        else {
            const aliasPrefix = alias + '/';
            if (importPath.startsWith(aliasPrefix)) {
                const rest = importPath.slice(aliasPrefix.length);
                resolvedPath = targetPath.endsWith('/')
                    ? targetPath + rest
                    : targetPath + '/' + rest;
            }
            else {
                resolvedPath = targetPath;
            }
        }
        return path.resolve(this.projectRoot, this.baseUrl, resolvedPath);
    }
    resolveRelativePath(importPath, sourceFile) {
        if (sourceFile) {
            return path.resolve(path.dirname(sourceFile), importPath);
        }
        return path.resolve(this.projectRoot, this.baseUrl, importPath);
    }
    checkFileExists(filePath) {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.d.ts', ''];
        const indexFiles = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
        for (const ext of extensions) {
            if (fs.existsSync(filePath + ext)) {
                return true;
            }
        }
        for (const indexFile of indexFiles) {
            if (fs.existsSync(filePath + indexFile)) {
                return true;
            }
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            return indexFiles.some(indexFile => fs.existsSync(filePath + indexFile));
        }
        return false;
    }
    getPaths() {
        return { ...this.paths };
    }
    getBaseUrl() {
        return this.baseUrl;
    }
}
exports.PathResolver = PathResolver;
