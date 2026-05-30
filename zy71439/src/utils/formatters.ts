export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟${secs}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  }
  return `${secs}秒`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    beginner: '入门级',
    intermediate: '进阶级',
    advanced: '高级'
  };
  return labels[difficulty] || difficulty;
}

export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    beginner: 'text-green-600',
    intermediate: 'text-yellow-600',
    advanced: 'text-red-600'
  };
  return colors[difficulty] || 'text-gray-600';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待确认',
    approved: '已处理',
    returned: '需退回'
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    returned: 'bg-red-100 text-red-800 border-red-300'
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
}

export function getRiskLabel(risk: string): string {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  };
  return labels[risk] || risk;
}

export function getRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600'
  };
  return colors[risk] || 'text-gray-600';
}

export function getOperationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bearing_input: '输入方位角',
    bearing_modify: '修改方位角',
    position_mark: '标注位置',
    position_adjust: '调整位置',
    route_select: '选择路线',
    submit: '提交记录',
    unit_error_detected: '检测到单位错误',
    review_approve: '复核通过',
    review_return: '退回补材料'
  };
  return labels[type] || type;
}

export function getOperationTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    bearing_input: 'compass',
    bearing_modify: 'edit-3',
    position_mark: 'map-pin',
    position_adjust: 'move',
    route_select: 'route',
    submit: 'send',
    unit_error_detected: 'alert-triangle',
    review_approve: 'check-circle',
    review_return: 'rotate-ccw'
  };
  return icons[type] || 'circle';
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }
  const nauticalMiles = meters / 1852;
  if (nauticalMiles < 10) {
    return `${nauticalMiles.toFixed(2)}海里`;
  }
  return `${nauticalMiles.toFixed(1)}海里`;
}

export function formatBearing(degrees: number, unit: 'dms' | 'decimal' = 'decimal'): string {
  if (unit === 'dms') {
    const deg = Math.floor(degrees);
    const min = Math.floor((degrees - deg) * 60);
    const sec = ((degrees - deg) * 60 - min) * 60;
    return `${deg}°${min}'${sec.toFixed(1)}"`;
  }
  return `${degrees.toFixed(4)}°`;
}
