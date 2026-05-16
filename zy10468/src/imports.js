import fs from 'fs/promises';
import path from 'path';

const IMPORT_REGEX = /^(?:import|export)\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["']/gm;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

export async function parseImports(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const imports = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    let match;
    IMPORT_REGEX.lastIndex = 0;
    while ((match = IMPORT_REGEX.exec(line)) !== null) {
      imports.push({
        path: match[1],
        line: lineNum + 1,
        column: match.index + 1,
        type: 'static',
        source: line.trim(),
      });
    }

    DYNAMIC_IMPORT_REGEX.lastIndex = 0;
    while ((match = DYNAMIC_IMPORT_REGEX.exec(line)) !== null) {
      imports.push({
        path: match[1],
        line: lineNum + 1,
        column: match.index + 1,
        type: 'dynamic',
        source: line.trim(),
      });
    }
  }

  return imports;
}

export function resolveImportPath(importPath, sourceFilePath, packages) {
  if (importPath.startsWith('.')) {
    const sourceDir = path.dirname(sourceFilePath);
    const resolved = path.resolve(sourceDir, importPath);
    return { type: 'relative', resolvedPath: resolved, package: null };
  }

  for (const pkg of packages) {
    if (importPath === pkg.name || importPath.startsWith(pkg.name + '/')) {
      return { type: 'internal', resolvedPath: null, package: pkg };
    }
  }

  return { type: 'external', resolvedPath: null, package: null };
}
