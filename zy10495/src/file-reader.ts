import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { parse } from 'yaml';
import { TranslationEntry } from './types.js';

export async function findTranslationFiles(
  pattern: string,
  cwd: string
): Promise<string[]> {
  const files = await glob(pattern, { cwd, absolute: true });
  return files.filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
}

export async function readTranslationFile(
  filePath: string
): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    return parse(content) as Record<string, string>;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

function flattenObject(
  obj: Record<string, any>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, fullKey));
    }
  }

  return result;
}

export async function loadTranslations(
  filePath: string,
  language: string
): Promise<TranslationEntry[]> {
  const data = await readTranslationFile(filePath);
  const flattened = flattenObject(data);

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const entries: TranslationEntry[] = [];

  for (const [key, value] of Object.entries(flattened)) {
    let lineNumber: number | undefined;
    const keyParts = key.split('.');
    const searchKey = keyParts[keyParts.length - 1];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${searchKey}"`) || lines[i].includes(`${searchKey}:`)) {
        lineNumber = i + 1;
        break;
      }
    }

    entries.push({
      key,
      value,
      filePath,
      language,
      lineNumber,
    });
  }

  return entries;
}

export function extractLanguageFromFilename(
  filePath: string,
  pattern: string = '([a-z]{2}(-[A-Z]{2})?)'
): string | null {
  const filename = path.basename(filePath);
  const match = filename.match(new RegExp(pattern));
  return match ? match[1] : null;
}

export async function ensureOutputDir(outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
}
