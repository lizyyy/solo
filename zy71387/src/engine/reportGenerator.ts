import type { RiskItem, ChangeOrder, InspectionReport } from '@/types'

export function generateReport(
  risks: RiskItem[],
  changeOrders: ChangeOrder[],
  title?: string
): InspectionReport {
  const now = new Date().toISOString()
  const pendingRisks = risks.filter((r) => r.status === 'pending')
  const highRisks = pendingRisks.filter((r) => r.severity === 'high')
  const mediumRisks = pendingRisks.filter((r) => r.severity === 'medium')
  const lowRisks = pendingRisks.filter((r) => r.severity === 'low')

  const topRisks = pendingRisks.slice(0, 10)

  const summary = [
    `巡检时间：${new Date(now).toLocaleString('zh-CN')}`,
    `待处理风险：${pendingRisks.length} 条（高危 ${highRisks.length} / 中危 ${mediumRisks.length} / 低危 ${lowRisks.length}）`,
    `变更单：${changeOrders.length} 条（已审批 ${changeOrders.filter((c) => c.status === 'approved').length} / 待审批 ${changeOrders.filter((c) => c.status === 'pending').length}）`,
    highRisks.length > 0
      ? `⚠️ 高危项需立即处理：${highRisks.map((r) => r.description).join('；')}`
      : '✅ 无高危风险项',
  ].join('\n')

  return {
    id: `rpt_${Date.now()}`,
    title: title || `数据血缘巡检报告 - ${new Date(now).toLocaleDateString('zh-CN')}`,
    generatedAt: now,
    totalBreakpoints: risks.filter((r) => r.riskType === 'lineage_break' && r.status === 'pending')
      .length,
    totalRisks: pendingRisks.length,
    highRiskCount: highRisks.length,
    mediumRiskCount: mediumRisks.length,
    lowRiskCount: lowRisks.length,
    topRisks,
    changeOrders,
    summary,
  }
}

export function exportToCSV(report: InspectionReport): string {
  const header = '风险类型,严重程度,描述,影响范围,状态\n'
  const rows = report.topRisks
    .map(
      (r) =>
        `"${r.riskType}","${r.severity}","${r.description}","${r.impactRange}","${r.status}"`
    )
    .join('\n')
  return header + rows
}
