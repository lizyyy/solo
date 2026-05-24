import { RetentionUnit, UNIT_CONVERSIONS } from '../types';

export function parseRetention(value: string | number): { days: number; rawValue: string } {
  const rawValue = String(value).trim();

  if (typeof value === 'number') {
    return { days: Math.round(value), rawValue };
  }

  const numMatch = value.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    const unit = (numMatch[2] || 'days').toLowerCase() as RetentionUnit;

    if (UNIT_CONVERSIONS[unit] !== undefined) {
      return { days: Math.round(num * UNIT_CONVERSIONS[unit]), rawValue };
    }
  }

  const pureNumber = parseFloat(value);
  if (!isNaN(pureNumber)) {
    return { days: Math.round(pureNumber), rawValue };
  }

  throw new Error(`无法解析留存时间格式: "${value}"。支持的格式: 30, 30d, 4w, 3m, 1y 等`);
}

export function formatRetention(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function normalizeServiceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
