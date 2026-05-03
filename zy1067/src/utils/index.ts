import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export function generateId(): string {
  return uuidv4();
}

export function formatDate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function getTimestampFilename(date: Date = new Date()): string {
  return format(date, 'yyyyMMdd-HHmmss');
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export function resolvePath(basePath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(path.dirname(basePath), relativePath);
}

export function isUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

export function isHtmlFile(input: string): boolean {
  return input.toLowerCase().endsWith('.html') || input.toLowerCase().endsWith('.htm');
}

export function fileUrlToPath(fileUrl: string): string {
  const url = new URL(fileUrl);
  return decodeURIComponent(url.pathname);
}

export function pathToFileUrl(filePath: string): string {
  return `file://${filePath}`;
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function generateUniqueSelector(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current) {
    const tag = current.tagName.toLowerCase();
    let part = tag;

    if (current.id) {
      part = `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }

    const siblings = Array.from(current.parentElement?.children || []);
    const sameTagSiblings = siblings.filter(
      (s) => s.tagName.toLowerCase() === tag
    );

    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1;
      part = `${tag}:nth-of-type(${index})`;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      if (classes) {
        part = part + classes;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

export function getElementOuterHtml(element: HTMLElement, maxLength: number = 300): string {
  const outerHtml = element.outerHTML;
  if (outerHtml.length <= maxLength) {
    return outerHtml;
  }
  return outerHtml.slice(0, maxLength - 3) + '...';
}

export function countBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
