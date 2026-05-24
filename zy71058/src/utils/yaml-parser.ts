import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

export interface ParsedFile {
  filePath: string;
  content: string;
  data: unknown;
  lines: string[];
}

export interface ValueNode {
  path: string;
  value: string;
  line: number;
}

export function parseYamlFile(filePath: string): ParsedFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let data: unknown;
  try {
    data = yaml.load(content);
  } catch (e) {
    throw new Error(`YAML 解析失败 ${filePath}: ${(e as Error).message}`);
  }

  return { filePath, content, data, lines };
}

export function extractAllValues(data: unknown, prefix = ''): ValueNode[] {
  const results: ValueNode[] = [];

  if (data === null || data === undefined) {
    return results;
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const newPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
        results.push(...extractAllValues(item, newPrefix));
      });
    } else {
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          results.push(...extractAllValues(value, newPrefix));
        } else if (value !== null && value !== undefined) {
          results.push({
            path: newPrefix,
            value: String(value),
            line: 0
          });
        }
      }
    }
  } else {
    results.push({
      path: prefix,
      value: String(data),
      line: 0
    });
  }

  return results;
}

export function findYamlFiles(dir: string): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }

  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...findYamlFiles(fullPath));
    } else if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.tpl')) {
      results.push(fullPath);
    }
  }

  return results;
}

export function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (value !== null && value !== undefined) {
      result[newKey] = String(value);
    }
  }

  return result;
}
