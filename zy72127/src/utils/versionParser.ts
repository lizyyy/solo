import type { ParsedFilename } from '@/types';

export function parseFilename(filename: string): ParsedFilename {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const patterns = [
    /^(.+?)_v([^_]+)(?:_(\d{8}))?(?:_(.+))?$/,
    /^(.+?)_([^_]+)(?:_(\d{8}))?(?:_(.+))?$/,
    /^(.+?)-v([^-]+)(?:-(\d{8}))?(?:-(.+))?$/,
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return {
        name: match[1] || nameWithoutExt,
        version: match[2] || '1.0.0',
        date: match[3],
        operator: match[4],
      };
    }
  }
  
  return {
    name: nameWithoutExt,
    version: '1.0.0',
  };
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const parts1 = parse(v1);
  const parts2 = parse(v2);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
}
