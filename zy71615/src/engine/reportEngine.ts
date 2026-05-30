import type { Order, Container, CabinSlot, LedgerEntry, ReportEntry, RoundSnapshot } from './types'

export interface ReportData {
  entries: ReportEntry[]
  roundSnapshots: RoundSnapshot[]
  totalProfit: number
  errorSummary: { type: string; count: number; label: string }[]
}

export function buildReport(
  reportEntries: ReportEntry[],
  roundSnapshots: RoundSnapshot[],
  balance: number,
  initialBalance: number,
): ReportData {
  const totalProfit = balance - initialBalance

  const errorCounts: Record<string, { count: number; label: string }> = {}
  for (const entry of reportEntries) {
    for (const et of entry.errorTypes) {
      if (!errorCounts[et]) {
        const labels: Record<string, string> = {
          exchange_rate_reversal: '汇率反向操作',
          cabin_overbooking: '舱位超订',
          breach_penalty_missed: '违约金漏扣',
        }
        errorCounts[et] = { count: 0, label: labels[et] || et }
      }
      errorCounts[et].count++
    }
  }

  return {
    entries: reportEntries,
    roundSnapshots,
    totalProfit,
    errorSummary: Object.entries(errorCounts).map(([type, data]) => ({
      type,
      count: data.count,
      label: data.label,
    })),
  }
}
