import * as fs from 'fs';
import * as path from 'path';
import { SourcemapReference } from './types';

const SOURCEMAP_PATTERNS: Array<{
  type: 'comment' | 'hidden' | 'url';
  pattern: RegExp;
  groupIndex: number;
}> = [
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

export function findLineAndColumn(content: string, charIndex: number): { line: number; column: number } {
  const lines = content.slice(0, charIndex).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

export function parseSourcemapReferences(content: string): SourcemapReference[] {
  const references: SourcemapReference[] = [];
  const seen = new Set<string>();

  for (const { type, pattern, groupIndex } of SOURCEMAP_PATTERNS) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(content)) !== null) {
      const value = match[groupIndex];
      const { line, column } = findLineAndColumn(content, match.index);
      const raw = match[0];

      const key = `${type}:${value}:${line}:${column}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const finalType: SourcemapReference['type'] = value.startsWith('data:') ? 'inline' : type;

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

export async function parseFile(filePath: string): Promise<SourcemapReference[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return parseSourcemapReferences(content);
}

export function resolveSourcemapPath(jsFilePath: string, mapPath: string): string {
  if (mapPath.startsWith('http://') || mapPath.startsWith('https://') || mapPath.startsWith('//')) {
    return mapPath;
  }
  if (mapPath.startsWith('data:')) {
    return mapPath;
  }
  return path.resolve(path.dirname(jsFilePath), mapPath);
}

export function isValidSourcemap(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return (
      parsed.version !== undefined &&
      (parsed.sources !== undefined || parsed.mappings !== undefined)
    );
  } catch {
    return false;
  }
}

export async function checkSourcemapValidity(filePath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return isValidSourcemap(content);
  } catch {
    return false;
  }
}
