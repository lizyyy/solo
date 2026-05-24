import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export function readFile(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf-8');
}

export function parseJsonOrYaml(content: string, filePath: string): any {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`JSON 解析错误 (${filePath}): ${(e as Error).message}`);
    }
  }

  if (ext === '.yaml' || ext === '.yml') {
    try {
      return yaml.load(content);
    } catch (e) {
      throw new Error(`YAML 解析错误 (${filePath}): ${(e as Error).message}`);
    }
  }

  try {
    return JSON.parse(content);
  } catch {
    try {
      return yaml.load(content);
    } catch (e) {
      throw new Error(`无法解析文件 (${filePath}): 不是有效的 JSON 或 YAML 格式`);
    }
  }
}

export function ensureDir(dirPath: string): void {
  const absolutePath = path.resolve(dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

export function writeFile(filePath: string, content: string): void {
  const absolutePath = path.resolve(filePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content, 'utf-8');
}
