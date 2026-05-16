import * as fs from 'fs';
import * as path from 'path';
import { ValidationError } from '../types';

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function readJsonFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`解析JSON文件失败: ${filePath}, 错误: ${(error as Error).message}`);
  }
}

export function writeJsonFile(filePath: string, data: unknown, pretty = true): void {
  ensureDir(path.dirname(filePath));
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function seededRandom(seed: number): () => number {
  let s = seed;
  return function (): number {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateId(seed: number, index: number, type: string): string {
  const hash = `${seed}-${index}-${type}-${Date.now()}`;
  return Buffer.from(hash).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

export function formatErrorForReport(error: ValidationError): string {
  const parts = [
    `路径: ${error.instancePath || '/'}`,
    `关键字: ${error.keyword}`,
    `消息: ${error.message}`
  ];
  if (Object.keys(error.params).length > 0) {
    parts.push(`参数: ${JSON.stringify(error.params)}`);
  }
  return parts.join(' | ');
}

export function getFieldType(schema: Record<string, unknown>, fieldPath: string): string {
  const parts = fieldPath.split('.').filter(Boolean);
  let current: Record<string, unknown> = schema;
  
  for (const part of parts) {
    if (current.properties && typeof current.properties === 'object') {
      const props = current.properties as Record<string, unknown>;
      if (props[part]) {
        current = props[part] as Record<string, unknown>;
      } else {
        return 'unknown';
      }
    } else if (current.items && typeof current.items === 'object') {
      current = current.items as Record<string, unknown>;
    }
  }
  
  return (current.type as string) || 'unknown';
}

export function listAllFields(schema: Record<string, unknown>, prefix = ''): string[] {
  const fields: string[] = [];
  
  if (schema.properties && typeof schema.properties === 'object') {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    for (const [key, prop] of Object.entries(props)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      fields.push(fullPath);
      
      if (prop.type === 'object') {
        fields.push(...listAllFields(prop, fullPath));
      } else if (prop.type === 'array' && prop.items && typeof prop.items === 'object') {
        const items = prop.items as Record<string, unknown>;
        if (items.properties) {
          fields.push(...listAllFields(items, `${fullPath}[]`));
        }
      }
    }
  }
  
  return fields;
}
