import * as fs from 'fs';
import * as path from 'path';
import { LocaleEntry } from './types';

const PLURAL_KEY_PATTERNS = [
  /(.+)_zero$/,
  /(.+)_one$/,
  /(.+)_two$/,
  /(.+)_few$/,
  /(.+)_many$/,
  /(.+)_other$/,
  /(.+)\[zero\]$/,
  /(.+)\[one\]$/,
  /(.+)\[two\]$/,
  /(.+)\[few\]$/,
  /(.+)\[many\]$/,
  /(.+)\[other\]$/,
];

export function parseI18nFile(filePath: string): LocaleEntry[] {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf-8');
  const locale = detectLocaleFromPath(filePath);
  
  let data: Record<string, any>;
  
  if (ext === '.json') {
    data = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    data = parseYaml(content);
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  return flattenObject(data, locale);
}

function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');
  const stack: { indent: number; obj: Record<string, any>; key: string }[] = [];
  let currentObj = result;
  let currentIndent = -1;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, indentStr, key, value] = match;
    const indent = indentStr.length;
    const cleanKey = key.trim().replace(/^['"]|['"]$/g, '');
    const cleanValue = value.trim().replace(/^['"]|['"]$/g, '');

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      const popped = stack.pop()!;
      currentObj = popped.obj;
    }

    if (cleanValue) {
      currentObj[cleanKey] = cleanValue;
    } else {
      const newObj: Record<string, any> = {};
      currentObj[cleanKey] = newObj;
      stack.push({ indent, obj: currentObj, key: cleanKey });
      currentObj = newObj;
    }
  }

  return result;
}

function flattenObject(
  obj: Record<string, any>,
  locale: string,
  prefix = ''
): LocaleEntry[] {
  const entries: LocaleEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      const { baseKey, pluralForm } = detectPluralForm(fullKey);
      entries.push({
        key: baseKey,
        value,
        locale,
        pluralForm,
        originalValue: value,
      });
    } else if (value && typeof value === 'object') {
      if (isPluralObject(value)) {
        for (const [pluralKey, pluralValue] of Object.entries(value)) {
          if (typeof pluralValue === 'string') {
            entries.push({
              key: fullKey,
              value: pluralValue,
              locale,
              pluralForm: pluralKey,
              originalValue: pluralValue,
            });
          }
        }
      } else {
        entries.push(...flattenObject(value, locale, fullKey));
      }
    }
  }

  return entries;
}

function detectPluralForm(key: string): { baseKey: string; pluralForm?: string } {
  for (const pattern of PLURAL_KEY_PATTERNS) {
    const match = key.match(pattern);
    if (match) {
      const pluralForm = key.includes('[')
        ? key.match(/\[(.+)\]$/)?.[1]
        : key.split('_').pop();
      return { baseKey: match[1], pluralForm };
    }
  }
  return { baseKey: key };
}

function isPluralObject(obj: Record<string, any>): boolean {
  const pluralKeys = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every(k => pluralKeys.includes(k));
}

function detectLocaleFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  const filename = path.basename(filePath, path.extname(filePath));
  
  const localePattern = /^[a-z]{2}([-_][A-Z]{2})?$/;
  if (localePattern.test(filename)) {
    return filename.replace('_', '-');
  }
  
  for (const part of parts.reverse()) {
    if (localePattern.test(part)) {
      return part.replace('_', '-');
    }
  }
  
  return 'unknown';
}

export function extractPlaceholders(text: string): string[] {
  const placeholders: string[] = [];
  const patterns = [
    /\{(\w+)\}/g,
    /\%\{(\w+)\}/g,
    /\$(\w+)/g,
    /\$(\{(\w+)\})/g,
    /\{\{(\w+)\}\}/g,
    /\%s/g,
    /\%d/g,
    /\%f/g,
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const placeholder = match[0];
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }
  }

  return placeholders;
}
