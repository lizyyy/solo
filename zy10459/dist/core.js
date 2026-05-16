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
exports.readPackageJson = readPackageJson;
exports.resolveExportsPath = resolveExportsPath;
exports.parseExports = parseExports;
exports.scanPackageFiles = scanPackageFiles;
exports.findMissingPaths = findMissingPaths;
exports.generateImportExamples = generateImportExamples;
exports.runCheck = runCheck;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function readPackageJson(packageDir) {
    const pkgPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`package.json not found at ${pkgPath}`);
    }
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}
function resolveExportsPath(exportsValue, basePath, exportPath, conditions = []) {
    const entries = [];
    if (typeof exportsValue === 'string') {
        const resolvedPath = exportsValue.startsWith('./')
            ? exportsValue.slice(2)
            : exportsValue;
        const absolutePath = path.join(basePath, resolvedPath);
        entries.push({
            path: exportPath,
            exportPath,
            resolvedPath,
            conditions: [...conditions],
            fileExists: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
            source: 'exports',
        });
    }
    else if (Array.isArray(exportsValue)) {
        for (const item of exportsValue) {
            entries.push(...resolveExportsPath(item, basePath, exportPath, conditions));
        }
    }
    else if (typeof exportsValue === 'object' && exportsValue !== null) {
        for (const [key, value] of Object.entries(exportsValue)) {
            if (key === 'default' || key === 'import' || key === 'require' || key === 'types' || key === 'node') {
                if (value === null) {
                    entries.push({
                        path: exportPath,
                        exportPath,
                        resolvedPath: null,
                        conditions: [...conditions, key],
                        fileExists: false,
                        error: 'Explicitly set to null (excluded)',
                        source: 'exports',
                    });
                }
                else {
                    entries.push(...resolveExportsPath(value, basePath, exportPath, [...conditions, key]));
                }
            }
            else {
                const subPath = exportPath === '.' ? `./${key}` : `${exportPath}/${key}`;
                entries.push(...resolveExportsPath(value, basePath, subPath, conditions));
            }
        }
    }
    return entries;
}
function parseExports(pkg, packageDir) {
    const entries = [];
    if (pkg.main) {
        const absolutePath = path.join(packageDir, pkg.main);
        entries.push({
            path: '.',
            exportPath: '.',
            resolvedPath: pkg.main,
            conditions: [],
            fileExists: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
            source: 'main',
        });
    }
    if (pkg.module) {
        const absolutePath = path.join(packageDir, pkg.module);
        entries.push({
            path: '.',
            exportPath: '.',
            resolvedPath: pkg.module,
            conditions: ['import', 'module'],
            fileExists: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
            source: 'module',
        });
    }
    if (pkg.types) {
        const absolutePath = path.join(packageDir, pkg.types);
        entries.push({
            path: '.',
            exportPath: '.',
            resolvedPath: pkg.types,
            conditions: ['types'],
            fileExists: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
            source: 'types',
        });
    }
    if (pkg.exports) {
        if (typeof pkg.exports === 'string') {
            entries.push(...resolveExportsPath(pkg.exports, packageDir, '.'));
        }
        else if (typeof pkg.exports === 'object') {
            for (const [key, value] of Object.entries(pkg.exports)) {
                entries.push(...resolveExportsPath(value, packageDir, key));
            }
        }
    }
    return entries;
}
function scanPackageFiles(packageDir) {
    const files = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'test', 'tests', '__tests__'];
    function scanDir(dir, relativePath = '') {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relPath = path.join(relativePath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (!excludeDirs.includes(item)) {
                    files.push({
                        path: relPath,
                        exists: true,
                        isDirectory: true,
                        isFile: false,
                        absolutePath: fullPath,
                    });
                    scanDir(fullPath, relPath);
                }
            }
            else if (stat.isFile()) {
                files.push({
                    path: relPath,
                    exists: true,
                    isDirectory: false,
                    isFile: true,
                    absolutePath: fullPath,
                });
            }
        }
    }
    try {
        scanDir(packageDir);
    }
    catch (e) {
        // Ignore scanning errors
    }
    return files;
}
function findMissingPaths(exports, files, pkg) {
    const missing = [];
    const exportedPaths = new Set(exports.filter(e => e.resolvedPath).map(e => e.resolvedPath));
    const jsFiles = files.filter(f => f.isFile && /\.(js|mjs|cjs|ts|d\.ts)$/.test(f.path));
    for (const file of jsFiles) {
        const normalizedPath = file.path.replace(/\\/g, '/');
        if (!exportedPaths.has(normalizedPath) && !exportedPaths.has('./' + normalizedPath)) {
            const inFilesArray = pkg.files?.some(pattern => {
                if (pattern.endsWith('/')) {
                    return normalizedPath.startsWith(pattern.slice(0, -1));
                }
                return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
            }) ?? true;
            missing.push({
                path: normalizedPath,
                expectedInExports: true,
                expectedInFiles: inFilesArray,
                reason: 'File exists but not exported via exports field',
                actualLocation: file.absolutePath,
            });
        }
    }
    for (const exp of exports) {
        if (exp.resolvedPath && !exp.fileExists) {
            missing.push({
                path: exp.resolvedPath,
                expectedInExports: true,
                expectedInFiles: true,
                reason: `Export path "${exp.exportPath}" points to non-existent file`,
                actualLocation: path.join(pkg.name || '', exp.resolvedPath),
            });
        }
    }
    return missing;
}
function generateImportExamples(exports, packageName) {
    const examples = [];
    const seenPaths = new Set();
    for (const exp of exports) {
        if (seenPaths.has(exp.exportPath))
            continue;
        seenPaths.add(exp.exportPath);
        const importPath = exp.exportPath === '.' ? packageName : `${packageName}/${exp.exportPath.replace(/^\.\//, '')}`;
        examples.push({
            importPath: `import '${importPath}'`,
            shouldWork: exp.fileExists,
            actualPath: exp.resolvedPath || undefined,
            error: exp.error || (exp.fileExists ? undefined : 'Target file does not exist'),
            sourceLocation: exp.resolvedPath || undefined,
        });
        examples.push({
            importPath: `require('${importPath}')`,
            shouldWork: exp.fileExists,
            actualPath: exp.resolvedPath || undefined,
            error: exp.error || (exp.fileExists ? undefined : 'Target file does not exist'),
            sourceLocation: exp.resolvedPath || undefined,
        });
    }
    return examples;
}
function runCheck(packageDir, options = {}) {
    const absolutePackageDir = path.resolve(packageDir);
    const pkg = readPackageJson(absolutePackageDir);
    const exports = parseExports(pkg, absolutePackageDir);
    const files = scanPackageFiles(absolutePackageDir);
    const missingPaths = findMissingPaths(exports, files, pkg);
    const importExamples = options.includeImports ? generateImportExamples(exports, pkg.name || 'package') : [];
    const validExports = exports.filter(e => e.fileExists).length;
    const invalidExports = exports.filter(e => !e.fileExists).length;
    const missingFiles = missingPaths.length;
    const errors = [];
    const warnings = [];
    if (invalidExports > 0) {
        errors.push(`${invalidExports} export(s) point to non-existent files`);
    }
    if (missingFiles > 0) {
        warnings.push(`${missingFiles} file(s) exist but are not exported`);
    }
    if (!pkg.exports) {
        warnings.push('No "exports" field defined in package.json - using legacy resolution');
    }
    return {
        packageName: pkg.name || 'unknown',
        packageVersion: pkg.version || 'unknown',
        checkedAt: new Date().toISOString(),
        packageDir: absolutePackageDir,
        exports,
        files,
        importExamples,
        missingPaths,
        summary: {
            totalExports: exports.length,
            validExports,
            invalidExports,
            missingFiles,
            totalFiles: files.length,
        },
        errors,
        warnings,
    };
}
//# sourceMappingURL=core.js.map