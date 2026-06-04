export function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatResourceValue(value: number): string {
  if (value < 0) return `${value}`;
  return `${value}`;
}

export function getResourceColorClass(value: number, min: number, max: number): string {
  if (value < 0) return 'text-red-400';
  if (value < min) return 'text-orange-400';
  if (value > max) return 'text-yellow-400';
  const ratio = (value - min) / (max - min);
  if (ratio < 0.2) return 'text-yellow-300';
  return 'text-emerald-400';
}

export function getResourceBarPercent(value: number, min: number, max: number): number {
  const range = max - min;
  if (range === 0) return 0;
  return Math.max(0, Math.min(100, ((value - min) / range) * 100));
}

export function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    traffic_light: '信号灯',
    road_condition: '路况',
    weather: '天气',
    other: '其他',
  };
  return labels[type] || type;
}

export function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    traffic_light: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    road_condition: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    weather: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    other: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return colors[type] || colors.other;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: '待开始',
    running: '运行中',
    paused: '已暂停',
    finished: '已结束',
    error: '异常',
  };
  return labels[status] || status;
}

export function getStatusColorClass(status: string): string {
  const colors: Record<string, string> = {
    idle: 'bg-gray-500/20 text-gray-300',
    running: 'bg-emerald-500/20 text-emerald-300',
    paused: 'bg-yellow-500/20 text-yellow-300',
    finished: 'bg-blue-500/20 text-blue-300',
    error: 'bg-red-500/20 text-red-300',
  };
  return colors[status] || colors.idle;
}
