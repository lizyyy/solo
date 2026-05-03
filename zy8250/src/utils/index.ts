import * as fs from 'fs';
import * as path from 'path';
import { ValidationError, Issue, IssueType, IssueSeverity } from '../types';

export function validateFileExists(filePath: string): ValidationError | null {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      message: `文件不存在: ${filePath}`
    };
  }
  return null;
}

export function validateDirectoryExists(dirPath: string): ValidationError | null {
  if (!fs.existsSync(dirPath)) {
    return {
      file: dirPath,
      message: `目录不存在: ${dirPath}`
    };
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    return {
      file: dirPath,
      message: `路径不是目录: ${dirPath}`
    };
  }
  return null;
}

export function readJSONLFile(filePath: string): unknown[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`JSONL 文件第 ${index + 1} 行解析错误: ${(error as Error).message}`);
    }
  });
}

export function generateIssueId(): string {
  return `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export function createIssue(
  jobName: string,
  type: IssueType,
  severity: IssueSeverity,
  message: string,
  details?: Record<string, unknown>
): Issue {
  return {
    id: generateIssueId(),
    jobName,
    type,
    severity,
    message,
    details,
    timestamp: Date.now()
  };
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}小时${minutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${remainingSeconds}秒`;
}

export function getPlistFilesInDirectory(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => file.endsWith('.plist'))
    .map(file => path.join(dirPath, file));
}

export function isScriptPathValid(scriptPath: string): boolean {
  if (!scriptPath) return false;
  
  if (scriptPath.startsWith('/')) {
    return fs.existsSync(scriptPath);
  }
  
  const expandedPath = scriptPath.replace('~', process.env.HOME || '');
  if (expandedPath.startsWith('/')) {
    return fs.existsSync(expandedPath);
  }
  
  return fs.existsSync(path.resolve(expandedPath));
}
