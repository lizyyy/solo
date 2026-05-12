import * as fs from 'fs';
import * as path from 'path';

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isSRT(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.srt');
}

export function isVTT(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.vtt');
}

export function isSubtitleFile(filePath: string): boolean {
  return isSRT(filePath) || isVTT(filePath);
}

export function readJsonFile<T = any>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (e) {
    return null;
  }
}

export function writeJsonFile(filePath: string, data: any): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncate(str: string, maxLen: number = 50): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
