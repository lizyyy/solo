export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}

export function generateId(prefix: string = ''): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getPressureColor(pressure: number): string {
  if (pressure >= 10.0) return '#ff3b30';
  if (pressure >= 8.0) return '#ff9500';
  return '#00d4aa';
}

export function getPressureBgColor(pressure: number): string {
  if (pressure >= 10.0) return 'rgba(255, 59, 48, 0.15)';
  if (pressure >= 8.0) return 'rgba(255, 149, 0, 0.15)';
  return 'rgba(0, 212, 170, 0.15)';
}

export function getLevelColor(level: 'normal' | 'warning' | 'danger'): string {
  const colors: Record<string, string> = {
    normal: '#00d4aa',
    warning: '#ff9500',
    danger: '#ff3b30',
  };
  return colors[level] || '#00d4aa';
}

export function getLevelLabel(level: 'normal' | 'warning' | 'danger'): string {
  const labels: Record<string, string> = {
    normal: '正常',
    warning: '警戒',
    danger: '危险',
  };
  return labels[level] || level;
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function groupBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T[]> {
  const groups = new Map<T[K], T[]>();
  for (const item of items) {
    const groupKey = item[key];
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  }
  return groups;
}

export function sortBy<T, K extends keyof T>(items: T[], key: K, ascending: boolean = true): T[] {
  return [...items].sort((a, b) => {
    if (a[key] < b[key]) return ascending ? -1 : 1;
    if (a[key] > b[key]) return ascending ? 1 : -1;
    return 0;
  });
}

export function isValidPressure(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100;
}

export function parsePressureInput(value: string): number | null {
  const num = parseFloat(value);
  if (isValidPressure(num)) {
    return num;
  }
  return null;
}

export function getShiftType(): 'day' | 'night' {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 20 ? 'day' : 'night';
}

export function getTimeRangeForShift(shiftDate: Date, shift: 'day' | 'night'): { start: number; end: number } {
  const start = new Date(shiftDate);
  const end = new Date(shiftDate);

  if (shift === 'day') {
    start.setHours(8, 0, 0, 0);
    end.setHours(20, 0, 0, 0);
  } else {
    start.setHours(20, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(8, 0, 0, 0);
  }

  return { start: start.getTime(), end: end.getTime() };
}
