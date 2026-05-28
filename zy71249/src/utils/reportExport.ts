import type { BusinessReport, ReplayRecord } from '@/types/game'
import { MATERIALS } from '@/data/gameConfig'

export function exportAsJson(report: BusinessReport): void {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `supply_chain_report_${report.sessionId}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsCsv(report: BusinessReport): void {
  const headers = ['物料编号', '物料名称', '风险类型', '影响金额(CNY)', '描述', '回合']
  const riskTypeLabels: Record<string, string> = {
    DISRUPTION: '供应商断供',
    BACKLOG: '库存积压',
    FX_LOSS: '汇率亏损',
  }

  const seenKeys = new Set<string>()
  const rows: string[][] = []

  for (const r of report.riskRecords) {
    const key = `${r.materialId}-${r.type}-${r.round}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const material = MATERIALS.find(m => m.id === r.materialId)
    rows.push([
      r.materialId,
      material?.name || r.materialId,
      riskTypeLabels[r.type] || r.type,
      String(r.amount),
      `"${r.description.replace(/"/g, '""')}"`,
      String(r.round),
    ])
  }

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `supply_chain_report_${report.sessionId}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function getReplayList(): ReplayRecord[] {
  const raw = localStorage.getItem('supply_chain_replays')
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function getReplayById(id: string): ReplayRecord | null {
  const list = getReplayList()
  return list.find(r => r.sessionId === id) || null
}

export function clearReplays(): void {
  localStorage.removeItem('supply_chain_replays')
}
