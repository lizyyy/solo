export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function formatTemperature(value: number): string {
  return `${value.toFixed(1)}℃`
}

export function formatTempDiff(value: number): string {
  return `${value.toFixed(1)}K`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function generateRecordNo(index: number): string {
  return `REC-${String(index).padStart(3, '0')}`
}

export function generateSensorNo(index: number): string {
  return `SNS-BR-${String(index).padStart(3, '0')}`
}
