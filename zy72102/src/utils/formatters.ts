export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatEnergy(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + ' MJ';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(2) + ' kJ';
  }
  return value.toFixed(2) + ' J';
}

export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}时${m}分${s}秒`;
  } else if (m > 0) {
    return `${m}分${s}秒`;
  }
  return `${s}秒`;
}

export function getAnomalyTypeName(type: string): string {
  const names: Record<string, string> = {
    temperature: '温度异常',
    vibration: '振动异常',
    energy: '能量异常',
    velocity: '速度异常',
  };
  return names[type] || type;
}

export function getFieldName(field: string): string {
  const names: Record<string, string> = {
    timestamp: '时间',
    velocity: '速度',
    acceleration: '加速度',
    temperature: '温度',
    vibration: '振动',
    pressure: '压力',
  };
  return names[field] || field;
}

export function getFieldUnit(field: string): string {
  const units: Record<string, string> = {
    velocity: 'm/s',
    acceleration: 'm/s²',
    temperature: '°C',
    vibration: 'mm/s',
    pressure: 'kPa',
  };
  return units[field] || '';
}
