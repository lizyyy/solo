import { TTLPolicy } from '../types';

export const SECONDS_PER = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
};

export function toSeconds(value: number, unit: TTLPolicy['unit']): number {
  switch (unit) {
    case 'seconds': return value;
    case 'minutes': return value * SECONDS_PER.minute;
    case 'hours': return value * SECONDS_PER.hour;
    case 'days': return value * SECONDS_PER.day;
  }
}

export function formatTTL(seconds: number | null): string {
  if (seconds === null || seconds === -1) {
    return '永不过期 (NO TTL)';
  }
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} 时 ${minutes} 分`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days} 天 ${hours} 时`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parseDateToTimestamp(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}
