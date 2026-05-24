import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FieldTypeInfo, ConfigFile } from './types';

export function readFile(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolutePath, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

export function ensureDir(dirPath: string): void {
  const absolutePath = path.resolve(dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export function parseFieldType(typeStr: string): FieldTypeInfo {
  let isNonNull = false;
  let isList = false;
  let listInnerNonNull = false;
  let rawType = typeStr;

  if (rawType.endsWith('!')) {
    isNonNull = true;
    rawType = rawType.slice(0, -1);
  }

  if (rawType.startsWith('[') && rawType.endsWith(']')) {
    isList = true;
    rawType = rawType.slice(1, -1);
    if (rawType.endsWith('!')) {
      listInnerNonNull = true;
      rawType = rawType.slice(0, -1);
    }
  }

  return {
    isNonNull,
    isList,
    innerType: rawType,
    fullType: typeStr,
    rawType,
    listInnerNonNull,
  };
}

export function formatTypeInfo(info: FieldTypeInfo): string {
  let result = info.innerType;
  if (info.isList) {
    result = `[${result}${info.listInnerNonNull ? '!' : ''}]`;
  }
  if (info.isNonNull) {
    result += '!';
  }
  return result;
}

export function loadConfigFile(configPath?: string): ConfigFile | null {
  if (!configPath) {
    const defaultPaths = [
      '.gql-null-drift.json',
      '.gql-null-driftrc',
      'config/gql-null-drift.json',
    ];
    for (const p of defaultPaths) {
      if (fileExists(p)) {
        configPath = p;
        break;
      }
    }
  }

  if (!configPath || !fileExists(configPath)) {
    return null;
  }

  try {
    const content = readFile(configPath);
    return JSON.parse(content) as ConfigFile;
  } catch (e) {
    throw new Error(`配置文件解析失败: ${configPath}`);
  }
}

export function validateSchemaPath(filePath: string): void {
  if (!filePath) {
    throw new Error('Schema路径不能为空');
  }
  if (!fileExists(filePath)) {
    throw new Error(`Schema文件不存在: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!['.graphql', '.gql', '.json', '.sdl'].includes(ext)) {
    throw new Error(`不支持的Schema文件格式: ${filePath}`);
  }
}

export function validateQueryPaths(paths: string[]): void {
  for (const p of paths) {
    if (!fileExists(p)) {
      throw new Error(`查询文件不存在: ${p}`);
    }
    const ext = path.extname(p).toLowerCase();
    if (!['.graphql', '.gql'].includes(ext)) {
      throw new Error(`不支持的查询文件格式: ${p}`);
    }
  }
}

export function findQueryFiles(patterns: string[]): string[] {
  const files: string[] = [];
  for (const pattern of patterns) {
    const resolvedPath = path.resolve(pattern);
    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        const walk = (dir: string) => {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const entryStat = fs.statSync(fullPath);
            if (entryStat.isDirectory()) {
              walk(fullPath);
            } else if (['.graphql', '.gql'].includes(path.extname(entry).toLowerCase())) {
              files.push(fullPath);
            }
          }
        };
        walk(resolvedPath);
      } else if (stat.isFile()) {
        files.push(resolvedPath);
      }
    }
  }
  return [...new Set(files)];
}
