export function exportToCSV(headers: string[], rows: string[][], filename: string) {
  const bom = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell ?? '')
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','))
  ].join('\n')

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return dateStr
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
