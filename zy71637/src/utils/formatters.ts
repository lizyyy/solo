export const formatTime = (timestamp: number): string => {
  if (!timestamp || isNaN(timestamp)) return '--:--:--';
  
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  return `${hours}:${minutes}:${seconds}.${ms}`;
};

export const formatDate = (timestamp: number): string => {
  if (!timestamp || isNaN(timestamp)) return '----/--/--';
  
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}/${month}/${day}`;
};

export const formatDateTime = (timestamp: number): string => {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
};

export const formatPrice = (price: number, decimals: number = 2): string => {
  if (price === null || price === undefined || isNaN(price)) return '--';
  return price.toFixed(decimals);
};

export const formatQuantity = (quantity: number): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) return '--';
  
  if (quantity >= 10000) {
    return (quantity / 10000).toFixed(2) + '万';
  }
  if (quantity >= 1000) {
    return (quantity / 1000).toFixed(2) + 'k';
  }
  return Math.round(quantity).toString();
};

export const formatVolume = (volume: number): string => {
  if (volume === null || volume === undefined || isNaN(volume)) return '--';
  
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿';
  }
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万';
  }
  return Math.round(volume).toString();
};

export const formatPercent = (value: number, decimals: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatDuration = (ms: number): string => {
  if (!ms || isNaN(ms)) return '--';
  
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export const formatNumber = (num: number, decimals: number = 0): string => {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatLevel = (level: number): string => {
  if (level === null || level === undefined || isNaN(level)) return '--';
  const suffixes = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return suffixes[level - 1] || `第${level}档`;
};

export const formatSide = (isBid: boolean): string => {
  return isBid ? '买盘' : '卖盘';
};

export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || isNaN(bytes)) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
};
