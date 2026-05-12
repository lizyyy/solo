import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generateTicketCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TK-${timestamp}-${random}`;
}

export function generatePackageId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PKG-${timestamp}-${random}`;
}

export function generateIdempotentKey(endpoint: string, idempotencyKey?: string, body?: any): string {
  if (idempotencyKey) {
    return `KEY-${idempotencyKey}`;
  }
  const bodyStr = body ? JSON.stringify(body) : '';
  return `KEY-${endpoint}-${Date.now()}-${Math.random()}`;
}

export function now(): number {
  return Date.now();
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function calculateDiff(before: Record<string, any> | null, after: Record<string, any> | null): string[] {
  const diffs: string[] = [];
  
  if (!before || !after) {
    return diffs;
  }
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);
    
    if (beforeVal !== afterVal) {
      diffs.push(`${key}: ${beforeVal} -> ${afterVal}`);
    }
  }
  
  return diffs;
}

export function safeJsonParse(str: string | null): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
