import * as crypto from 'crypto';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShortId(): string {
  return crypto.randomBytes(8).toString('hex');
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function generateDeterministicId(...parts: (string | number)[]): string {
  const combined = parts.map(p => String(p)).join('|');
  return hashString(combined).substring(0, 16);
}
