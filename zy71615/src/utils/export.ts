import type { LedgerEntry, ReportEntry, RoundSnapshot } from '../engine/types'

function toCSVRow(fields: string[]): string {
  return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')
}

export function exportLedgerCSV(entries: LedgerEntry[]): void {
  const header = ['回合', '类型', '金额', '订单ID', '描述', '时间']
  const rows = entries.map(e => [
    e.round,
    e.type === 'income' ? '收入' : e.type === 'cabin_fee' ? '舱位费' : e.type === 'breach_penalty' ? '违约金' : '超订罚金',
    e.amount,
    e.orderId ?? '',
    e.description,
    new Date(e.timestamp).toLocaleString('zh-CN'),
  ])
  const csv = [header, ...rows].map(toCSVRow).join('\n')
  downloadFile(csv, 'cash-ledger.csv', 'text/csv;charset=utf-8')
}

export function exportReportJSON(entries: ReportEntry[], snapshots: RoundSnapshot[]): void {
  const data = { entries, snapshots, exportedAt: new Date().toISOString() }
  const json = JSON.stringify(data, null, 2)
  downloadFile(json, 'business-report.json', 'application/json')
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
