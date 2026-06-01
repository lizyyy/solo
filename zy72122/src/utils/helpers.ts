export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    passed: '已通过',
    needs_review: '需人工确认',
    legacy_amended: '旧口径补录',
  }
  return map[status] || status
}

export function sourceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    photo: '现场照片',
    manual: '手工记录',
    legacy: '旧口径补录',
  }
  return map[type] || type
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    created: '创建记录',
    validated: '校验通过',
    reviewed: '人工确认',
    amended: '修正记录',
    appended: '追加记录',
  }
  return map[action] || action
}

export function checkTypeLabel(type: string): string {
  const map: Record<string, string> = {
    direction: '方向符号',
    unit: '单位检查',
    interval: '时间间隔',
    gap: '采样缺口',
    threshold: '安全阈值',
  }
  return map[type] || type
}
