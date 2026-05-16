import * as fs from 'fs';
import * as path from 'path';
import {
  PackageJson,
  ExportEntry,
  FileInfo,
  ImportExample,
  MissingPath,
  CheckResult,
  ExportsValue,
} from './types';

export function readPackageJson(packageDir: string): PackageJson {
  const pkgPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

export function resolveExportsPath(
  exportsValue: ExportsValue,
  basePath: string,
  exportPath: string,
  conditions: string[] = []
): ExportEntry[] {
  const entries: ExportEntry[] = [];

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
  } else if (Array.isArray(exportsValue)) {
    for (const item of exportsValue) {
      entries.push(...resolveExportsPath(item, basePath, exportPath, conditions));
    }
  } else if (typeof exportsValue === 'object' && exportsValue !== null) {
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
        } else {
          entries.push(...resolveExportsPath(value as ExportsValue, basePath, exportPath, [...conditions, key]));
        }
      } else {
        const subPath = exportPath === '.' ? `./${key}` : `${exportPath}/${key}`;
        entries.push(...resolveExportsPath(value as ExportsValue, basePath, subPath, conditions));
      }
    }
  }

  return entries;
}

export function parseExports(pkg: PackageJson, packageDir: string): ExportEntry[] {
  const entries: ExportEntry[] = [];

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
    } else if (typeof pkg.exports === 'object') {
      for (const [key, value] of Object.entries(pkg.exports)) {
        entries.push(...resolveExportsPath(value, packageDir, key));
      }
    }
  }

  return entries;
}

export function scanPackageFiles(packageDir: string): FileInfo[] {
  const files: FileInfo[] = [];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'test', 'tests', '__tests__'];

  function scanDir(dir: string, relativePath: string = '') {
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
      } else if (stat.isFile()) {
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
  } catch (e) {
    // Ignore scanning errors
  }

  return files;
}

export function findMissingPaths(
  exports: ExportEntry[],
  files: FileInfo[],
  pkg: PackageJson
): MissingPath[] {
  const missing: MissingPath[] = [];
  const exportedPaths = new Set(
    exports.filter(e => e.resolvedPath).map(e => e.resolvedPath!)
  );

  const jsFiles = files.filter(
    f => f.isFile && /\.(js|mjs|cjs|ts|d\.ts)$/.test(f.path)
  );

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

export function generateImportExamples(exports: ExportEntry[], packageName: string): ImportExample[] {
  const examples: ImportExample[] = [];
  const seenPaths = new Set<string>();

  for (const exp of exports) {
    if (seenPaths.has(exp.exportPath)) continue;
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

export function runCheck(packageDir: string, options: { includeImports?: boolean } = {}): CheckResult {
  const absolutePackageDir = path.resolve(packageDir);
  const pkg = readPackageJson(absolutePackageDir);
  const exports = parseExports(pkg, absolutePackageDir);
  const files = scanPackageFiles(absolutePackageDir);
  const missingPaths = findMissingPaths(exports, files, pkg);
  const importExamples = options.includeImports ? generateImportExamples(exports, pkg.name || 'package') : [];

  const validExports = exports.filter(e => e.fileExists).length;
  const invalidExports = exports.filter(e => !e.fileExists).length;
  const missingFiles = missingPaths.length;

  const errors: string[] = [];
  const warnings: string[] = [];

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
