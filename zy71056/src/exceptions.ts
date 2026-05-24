import * as fs from 'fs';
import * as path from 'path';
import { ExceptionItem } from './types';

export function loadExceptions(filePath: string | undefined): ExceptionItem[] {
  if (!filePath) return [];

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`例外清单文件不存在: ${filePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(content);

  if (Array.isArray(data)) {
    return data.map(validateExceptionItem);
  }

  if (data.exceptions && Array.isArray(data.exceptions)) {
    return data.exceptions.map(validateExceptionItem);
  }

  throw new Error('例外清单格式无效');
}

function validateExceptionItem(item: any): ExceptionItem {
  if (!item.name || typeof item.name !== 'string') {
    throw new Error('例外项必须包含 name 字段');
  }

  if (!item.reason || typeof item.reason !== 'string') {
    throw new Error(`例外项 ${item.name} 必须包含 reason 字段`);
  }

  return {
    name: item.name,
    version: item.version,
    reason: item.reason,
    approvedBy: item.approvedBy,
    approvedAt: item.approvedAt,
  };
}

export function isPackageExcepted(
  packageName: string,
  packageVersion: string,
  exceptions: ExceptionItem[]
): ExceptionItem | null {
  return exceptions.find(ex => {
    if (ex.name !== packageName) return false;
    if (ex.version && ex.version !== packageVersion) return false;
    return true;
  }) || null;
}
