import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generateBatchNumber(prefix: string = 'BATCH'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}
