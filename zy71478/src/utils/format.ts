export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(decimals);
}

export function formatVelocity(value: number | null | undefined): string {
  return `${formatNumber(value)} m/s`;
}

export function formatTemperature(value: number | null | undefined): string {
  return `${formatNumber(value)} ℃`;
}

export function formatDistance(value: number | null | undefined): string {
  return `${formatNumber(value)} m`;
}

export function formatTime(value: number | null | undefined, unit: 's' | 'ms' = 's'): string {
  if (unit === 'ms') {
    return `${formatNumber(value, 4)} ms`;
  }
  return `${formatNumber(value, 6)} s`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function convertTimeToSeconds(timeDiff: number, unit: 's' | 'ms'): number {
  return unit === 'ms' ? timeDiff / 1000 : timeDiff;
}

export function convertSecondsToTime(seconds: number, targetUnit: 's' | 'ms'): number {
  return targetUnit === 'ms' ? seconds * 1000 : seconds;
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return formatDate(timestamp);
}
