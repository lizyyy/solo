export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatNumber(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

export function formatTorque(torque: number): string {
  return `${formatNumber(torque)} N·m`;
}

export function formatSpeed(speed: number): string {
  return `${formatNumber(speed, 0)} rpm`;
}

export function formatTemperature(temp: number): string {
  return `${formatNumber(temp, 1)} °C`;
}

export function formatLoadLevel(level: number): string {
  return `${level} 档`;
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'error': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'detected': return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
    case 'confirmed': return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30';
    case 'resolved': return 'text-green-500 bg-green-500/10 border-green-500/30';
    case 'dismissed': return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  }
}

export function getAnomalyTypeIcon(type: string): string {
  switch (type) {
    case 'sampling_shift': return '⏱️';
    case 'temp_over_limit': return '🌡️';
    case 'missing_load': return '⚙️';
    case 'duplicate_data': return '📋';
    case 'supplement_data': return '➕';
    default: return '⚠️';
  }
}
