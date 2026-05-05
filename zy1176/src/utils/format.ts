export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}

export function truncatePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;
  
  const separator = path.includes('/') ? '/' : '\\';
  const parts = path.split(separator);
  
  if (parts.length <= 2) {
    return path.substring(0, maxLength - 3) + '...';
  }
  
  const first = parts[0];
  const last = parts[parts.length - 1];
  const remaining = maxLength - first.length - last.length - 5;
  
  if (remaining <= 0) {
    return path.substring(0, maxLength - 3) + '...';
  }
  
  return `${first}${separator}...${separator}${last}`;
}
