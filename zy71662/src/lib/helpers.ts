export function formatForce(n: number): string {
  return `${n.toFixed(1)} N`
}

export function formatWeight(n: number, unit: 'kg' | 'lb'): string {
  return `${n.toFixed(1)} ${unit}`
}

export function formatRatio(n: number): string {
  return `${n.toFixed(1)}%`
}

export function getStatusColor(status: 'safe' | 'warning' | 'overload'): string {
  const map: Record<typeof status, string> = {
    safe: 'text-green-400',
    warning: 'text-amber-400',
    overload: 'text-red-400',
  }
  return map[status]
}

export function getStatusBg(status: 'safe' | 'warning' | 'overload'): string {
  const map: Record<typeof status, string> = {
    safe: 'bg-green-500/20',
    warning: 'bg-amber-500/20',
    overload: 'bg-red-500/20',
  }
  return map[status]
}

export function getSeverityColor(severity: 'critical' | 'warning' | 'info'): string {
  const map: Record<typeof severity, string> = {
    critical: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
  }
  return map[severity]
}

export function getSeverityBg(severity: 'critical' | 'warning' | 'info'): string {
  const map: Record<typeof severity, string> = {
    critical: 'bg-red-500/20',
    warning: 'bg-amber-500/20',
    info: 'bg-blue-500/20',
  }
  return map[severity]
}

export function getSchemeStatusColor(status: 'draft' | 'verified' | 'flagged'): string {
  const map: Record<typeof status, string> = {
    draft: 'text-zinc-400',
    verified: 'text-green-400',
    flagged: 'text-red-400',
  }
  return map[status]
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    unit_error: '单位错误',
    overload: '吊点超载',
    angle_reversed: '角度方向反',
    safety_insufficient: '安全系数不足',
  }
  return map[category] ?? category
}

export function severityLabel(severity: string): string {
  const map: Record<string, string> = {
    critical: '严重',
    warning: '警告',
    info: '提示',
  }
  return map[severity] ?? severity
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    resolved: '已解决',
    dismissed: '已忽略',
    draft: '草稿',
    verified: '已校验',
    flagged: '已标记',
  }
  return map[status] ?? status
}
