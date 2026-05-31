export function formatTimestamp(ts: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
    .replace('SSS', milliseconds);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}时${minutes % 60}分${seconds % 60}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function formatTimeOnly(ts: number): string {
  return formatTimestamp(ts, 'HH:mm:ss');
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isTimeInRange(ts: number, start?: number, end?: number): boolean {
  if (start !== undefined && ts < start) return false;
  if (end !== undefined && ts > end) return false;
  return true;
}

export function calculateTimeProgress(ts: number, start: number, end: number): number {
  if (end <= start) return 0;
  const progress = (ts - start) / (end - start);
  return Math.max(0, Math.min(1, progress));
}
