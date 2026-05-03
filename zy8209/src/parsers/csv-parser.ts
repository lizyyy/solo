import * as fs from 'fs';
import * as path from 'path';
import { ResourceOwner, ExceptionItem } from '../types';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function parseOwnerCsv(filePath: string): ResourceOwner[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const headerMap: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    headerMap[normalizedHeader] = index;
  });

  const owners: ResourceOwner[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    
    if (values.every(v => !v.trim())) {
      continue;
    }

    const owner: ResourceOwner = {
      resource_type: values[headerMap['resource_type'] ?? 0] || '',
      resource_name: values[headerMap['resource_name'] ?? 1] || '',
      owner: values[headerMap['owner'] ?? 2] || '',
      email: values[headerMap['email'] ?? 3] || '',
      department: values[headerMap['department'] ?? 4] || ''
    };

    if (owner.resource_type && owner.resource_name) {
      owners.push(owner);
    }
  }

  return owners;
}

export function parseExceptions(filePath: string): ExceptionItem[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    return parseExceptionsJson(filePath);
  } else if (ext === '.csv') {
    return parseExceptionsCsv(filePath);
  } else {
    try {
      return parseExceptionsJson(filePath);
    } catch {
      return parseExceptionsCsv(filePath);
    }
  }
}

function parseExceptionsJson(filePath: string): ExceptionItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data.map(item => ({
        resource: item.resource || item.Resource || '',
        issue_type: item.issue_type || item.issueType || item.IssueType || '*',
        reason: item.reason || item.Reason || '',
        valid_until: item.valid_until || item.validUntil || item.ValidUntil
      }));
    }
    
    if (typeof data === 'object' && data !== null) {
      return [{
        resource: data.resource || data.Resource || '',
        issue_type: data.issue_type || data.issueType || data.IssueType || '*',
        reason: data.reason || data.Reason || '',
        valid_until: data.valid_until || data.validUntil || data.ValidUntil
      }];
    }
    
    return [];
  } catch (error: any) {
    throw new Error(`例外清单 JSON 解析失败: ${error.message}`);
  }
}

function parseExceptionsCsv(filePath: string): ExceptionItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const headerMap: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    headerMap[normalizedHeader] = index;
  });

  const exceptions: ExceptionItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    
    if (values.every(v => !v.trim())) {
      continue;
    }

    const exception: ExceptionItem = {
      resource: values[headerMap['resource'] ?? 0] || '',
      issue_type: values[headerMap['issue_type'] ?? 1] || '*',
      reason: values[headerMap['reason'] ?? 2] || '',
      valid_until: values[headerMap['valid_until'] ?? 3] || undefined
    };

    if (exception.resource) {
      exceptions.push(exception);
    }
  }

  return exceptions;
}

export function buildOwnerMap(owners: ResourceOwner[]): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const owner of owners) {
    const key = `${owner.resource_type}:${owner.resource_name}`;
    map.set(key, owner.owner);
  }
  
  return map;
}
