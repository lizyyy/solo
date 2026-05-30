export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatStamina(level: number): { label: string; icon: string } {
  const staminaMap: Record<number, { label: string; icon: string }> = {
    1: { label: '轻松', icon: '☕️' },
    2: { label: '适中', icon: '🎸' },
    3: { label: '活力', icon: '⚡' },
    4: { label: '高强度', icon: '🔥' },
    5: { label: '极限', icon: '💀' },
  };
  return staminaMap[level] || { label: '未知', icon: '❓' };
}

export function getCopyrightStatusLabel(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: '有效', color: '#22c55e' },
    pending: { label: '待审核', color: '#f59e0b' },
    expired: { label: '已过期', color: '#ef4444' },
    restricted: { label: '受限', color: '#8b5cf6' },
  };
  return statusMap[status] || { label: '未知', color: '#6b7280' };
}

export function getWarningLevelColor(level: string): string {
  const colorMap: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };
  return colorMap[level] || '#6b7280';
}
