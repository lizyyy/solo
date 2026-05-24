import * as crypto from 'crypto';
import * as path from 'path';

export function generateId(...parts: string[]): string {
  const input = parts.join('|');
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}

export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

export function isExpired(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date < now;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function matchesGlobPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizeFilePath(filePath);
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '%%DOUBLE_STAR%%')
    .replace(/\*/g, '[^/]*')
    .replace(/%%DOUBLE_STAR%%/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function isJsFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.js' || ext === '.mjs' || ext === '.cjs';
}

export function isSourcemapFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.map';
}

export function ensureTrailingSlash(str: string): string {
  return str.endsWith('/') ? str : `${str}/`;
}

export function joinPublicPath(base: string, ...parts: string[]): string {
  const normalizedBase = ensureTrailingSlash(base);
  const normalizedParts = parts.map(p => p.replace(/^\//, ''));
  return normalizedBase + normalizedParts.join('/');
}

export function truncateString(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}
