export const STORAGE_KEYS = {
  REQUIREMENTS: 'stage_monitor_requirements',
  VERSIONS: 'stage_monitor_versions',
  FILTER_SNAPSHOTS: 'stage_monitor_snapshots',
  EXPORT_HISTORY: 'stage_monitor_exports',
  GLOBAL_CHANNELS: 'stage_monitor_global_channels',
  GLOBAL_MONITORS: 'stage_monitor_global_monitors',
  APP_STATE: 'stage_monitor_app_state'
} as const;

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function calculateMinutes(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

export function generateDataHash(filters: unknown, recordCount: number): string {
  const str = JSON.stringify({ filters, recordCount, timestamp: Date.now() });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatDateTimeForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function getChannelTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    vocals: '人声',
    guitar: '吉他',
    bass: '贝斯',
    drums: '鼓',
    keys: '键盘',
    other: '其他'
  };
  return labels[type] || type;
}

export function getMonitorPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    stage_left: '舞台左侧',
    stage_center: '舞台中央',
    stage_right: '舞台右侧',
    drummer: '鼓手位'
  };
  return labels[position] || position;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    pending: '待处理',
    conflict: '冲突'
  };
  return labels[status] || status;
}

export function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    channel_duplicate: '通道重名',
    monitor_missing: '返听漏配',
    change_over_timeout: '换场超时'
  };
  return labels[type] || type;
}

export function arrayDiff<T extends { id: string }>(
  arr1: T[],
  arr2: T[]
): {
  added: T[];
  removed: T[];
  modified: { from: T; to: T }[];
} {
  const map1 = new Map(arr1.map(item => [item.id, item]));
  const map2 = new Map(arr2.map(item => [item.id, item]));

  const added: T[] = [];
  const removed: T[] = [];
  const modified: { from: T; to: T }[] = [];

  for (const [id, item2] of map2) {
    if (!map1.has(id)) {
      added.push(item2);
    } else {
      const item1 = map1.get(id)!;
      if (JSON.stringify(item1) !== JSON.stringify(item2)) {
        modified.push({ from: item1, to: item2 });
      }
    }
  }

  for (const [id, item1] of map1) {
    if (!map2.has(id)) {
      removed.push(item1);
    }
  }

  return { added, removed, modified };
}
