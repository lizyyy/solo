import * as fs from 'fs';
import * as path from 'path';

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * 检查目录是否存在
 */
export function directoryExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 创建目录（递归）
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取文件内容
 */
export function readFile(filePath: string): string {
  if (!fileExists(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 写入文件内容
 */
export function writeFile(filePath: string, content: string): void {
  const dirPath = path.dirname(filePath);
  ensureDirectory(dirPath);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 读取JSON文件
 */
export function readJsonFile<T>(filePath: string): T {
  const content = readFile(filePath);
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`解析JSON文件失败: ${filePath}, 错误: ${(error as Error).message}`);
  }
}

/**
 * 写入JSON文件
 */
export function writeJsonFile<T>(filePath: string, data: T): void {
  const content = JSON.stringify(data, null, 2);
  writeFile(filePath, content);
}

/**
 * 读取目录中的所有文件
 */
export function listFiles(dirPath: string, pattern?: RegExp): string[] {
  if (!directoryExists(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  const filePaths = files.map(file => path.join(dirPath, file));
  
  if (pattern) {
    return filePaths.filter(filePath => {
      if (!fileExists(filePath)) return false;
      const fileName = path.basename(filePath);
      return pattern.test(fileName);
    });
  }
  
  return filePaths.filter(filePath => fileExists(filePath));
}

/**
 * 解析CSV文件
 */
export async function parseCsv(content: string): Promise<any[]> {
  const { parse } = await import('csv-parse/sync');
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (error) {
    throw new Error(`解析CSV失败: ${(error as Error).message}`);
  }
}

/**
 * 解析Markdown文件（简单解析）
 */
export function parseMarkdown(content: string): {
  title: string;
  sections: Array<{ title: string; content: string }>;
} {
  const lines = content.split('\n');
  const result: {
    title: string;
    sections: Array<{ title: string; content: string }>;
  } = {
    title: '',
    sections: []
  };

  let currentSection: { title: string; content: string } | null = null;
  let firstLine = true;

  for (const line of lines) {
    // 提取标题（第一个#行）
    if (firstLine && line.startsWith('# ')) {
      result.title = line.substring(2).trim();
      firstLine = false;
      continue;
    }
    firstLine = false;

    // 提取二级标题作为section
    if (line.startsWith('## ')) {
      if (currentSection) {
        result.sections.push(currentSection);
      }
      currentSection = {
        title: line.substring(3).trim(),
        content: ''
      };
      continue;
    }

    // 添加到当前section的内容
    if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }

  if (currentSection) {
    result.sections.push(currentSection);
  }

  return result;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
