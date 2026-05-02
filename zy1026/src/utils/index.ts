import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getFileHash(filePath: string, algorithm: string = 'sha256'): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(content).digest('hex');
}

export function getFileMtime(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.mtimeMs;
}

export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function isAnchor(href: string): boolean {
  return href.startsWith('#') || (href.includes('#') && !isUrl(href));
}

export function isLocalLink(href: string): boolean {
  return !isUrl(href) && !isAnchor(href) && !href.startsWith('mailto:') && !href.startsWith('tel:');
}

export function isExternalUrl(href: string): boolean {
  return isUrl(href) && (href.startsWith('http://') || href.startsWith('https://'));
}

export function parseAnchorFromHref(href: string): { file?: string; anchor?: string } {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) {
    return { file: href };
  }
  if (hashIndex === 0) {
    return { anchor: href.slice(1) };
  }
  return {
    file: href.slice(0, hashIndex),
    anchor: href.slice(hashIndex + 1)
  };
}

export function generateSlug(text: string, caseSensitive: boolean = false): string {
  let slug = text
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');
  
  if (!caseSensitive) {
    slug = slug.toLowerCase();
  }
  
  return slug;
}

export function makeUniqueAnchor(baseSlug: string, existingAnchors: Set<string>): string {
  let slug = baseSlug;
  let counter = 1;
  
  while (existingAnchors.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  existingAnchors.add(slug);
  return slug;
}

export function resolveRelativePath(baseDir: string, relativePath: string): string {
  return path.resolve(path.dirname(baseDir), relativePath);
}

export function matchesIgnorePatterns(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(filePath)) {
      return true;
    }
    
    if (filePath.includes(pattern.replace(/\*/g, ''))) {
      return true;
    }
  }
  return false;
}

export function matchesIgnoreUrls(url: string, ignoreUrls: string[]): boolean {
  for (const ignoreUrl of ignoreUrls) {
    if (ignoreUrl.includes('*')) {
      const pattern = ignoreUrl
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(url)) {
        return true;
      }
    } else if (url === ignoreUrl || url.startsWith(ignoreUrl)) {
      return true;
    }
  }
  return false;
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function calculateExitCode(severity: 'error' | 'warning' | 'info'): number {
  switch (severity) {
    case 'error':
      return 1;
    case 'warning':
      return 2;
    case 'info':
      return 0;
    default:
      return 0;
  }
}
