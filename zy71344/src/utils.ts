export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: '已确认',
    temporary: '临时备注',
    conflict: '冲突',
  }
  return map[status] || status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'text-status-confirmed',
    temporary: 'text-status-temporary',
    conflict: 'text-status-conflict',
  }
  return map[status] || ''
}

export function statusBg(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'bg-status-confirmed/20 text-status-confirmed',
    temporary: 'bg-status-temporary/20 text-status-temporary',
    conflict: 'bg-status-conflict/20 text-status-conflict',
  }
  return map[status] || ''
}

export function conflictTypeLabel(type: string): string {
  const map: Record<string, string> = {
    beat_drift: '八拍漂移',
    cut_overlap: '剪辑点重叠',
    note_overwrite: '备注覆盖',
  }
  return map[type] || type
}

export function downloadFile(content: string, filename: string, mimeType: string = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportToCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
  return [headerLine, ...dataLines].join('\n')
}
