import { createHash } from 'crypto';

export * from './mask';
export * from './logger';

export function generateIdempotencyKey(...args: string[]): string {
  const data = args.join('|');
  return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

export function isExpired(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date < now;
}

export function formatDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function isWithinTimeRange(
  dateStr: string,
  startTime: string,
  endTime: string
): boolean {
  const now = new Date();
  const date = new Date(dateStr);

  if (date.toDateString() !== now.toDateString()) {
    return false;
  }

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const start = new Date(now);
  start.setHours(startHour, startMin, 0, 0);

  const end = new Date(now);
  end.setHours(endHour, endMin, 0, 0);

  return now >= start && now <= end;
}

export function normalizePlateNumber(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, '');
}
