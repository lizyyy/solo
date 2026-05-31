export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分${seconds % 60}秒`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时${minutes % 60}分`;
  
  const days = Math.floor(hours / 24);
  return `${days}天${hours % 24}小时`;
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getTimeRange(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

export function addHours(date: string | Date, hours: number): string {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export function addDays(date: string | Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function getDefaultViewRange(): { startTime: string; endTime: string } {
  const now = new Date();
  const startTime = new Date(now);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(now);
  endTime.setDate(endTime.getDate() + 1);
  endTime.setHours(23, 59, 59, 999);
  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}

export function timeToPixel(
  time: string | Date,
  viewStart: string | Date,
  viewEnd: string | Date,
  width: number
): number {
  const t = new Date(time).getTime();
  const start = new Date(viewStart).getTime();
  const end = new Date(viewEnd).getTime();
  const range = end - start;
  return ((t - start) / range) * width;
}

export function pixelToTime(
  pixel: number,
  viewStart: string | Date,
  viewEnd: string | Date,
  width: number
): Date {
  const start = new Date(viewStart).getTime();
  const end = new Date(viewEnd).getTime();
  const range = end - start;
  const time = start + (pixel / width) * range;
  return new Date(time);
}
