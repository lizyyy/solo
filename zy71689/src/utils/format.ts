export const formatCurrency = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (timestamp: number | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTime = (timestamp: number | string): string => {
  return formatDate(timestamp);
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return formatDate(timestamp);
};

export const formatLargeNumber = (value: number): string => {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return formatNumber(value, 0);
};

export const getRatingColorClass = (rating: string): string => {
  const colorMap: Record<string, string> = {
    'AAA': 'text-emerald-400',
    'AA': 'text-green-400',
    'A': 'text-lime-400',
    'BBB': 'text-yellow-400',
    'BB': 'text-amber-400',
    'B': 'text-orange-400',
    'CCC': 'text-red-400',
  };
  return colorMap[rating] || 'text-gray-400';
};

export const getRatingBgColorClass = (rating: string): string => {
  const colorMap: Record<string, string> = {
    'AAA': 'bg-emerald-500/20 border-emerald-500/50',
    'AA': 'bg-green-500/20 border-green-500/50',
    'A': 'bg-lime-500/20 border-lime-500/50',
    'BBB': 'bg-yellow-500/20 border-yellow-500/50',
    'BB': 'bg-amber-500/20 border-amber-500/50',
    'B': 'bg-orange-500/20 border-orange-500/50',
    'CCC': 'bg-red-500/20 border-red-500/50',
  };
  return colorMap[rating] || 'bg-gray-500/20 border-gray-500/50';
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

  return parts.join('');
};
