import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { BusinessError } from '../errors.js'
import XLSX from 'xlsx'

export function generateReport(filters: Record<string, any> = {}, generatedBy: string = 'system'): any {
  const db = getDb()

  const now = new Date().toISOString()
  const title = filters.title || `风险报告 ${new Date().toLocaleDateString('zh-CN')}`

  const clientsByRiskLevel = db.prepare(`
    SELECT risk_level, COUNT(*) as count FROM clients GROUP BY risk_level
  `).all() as { risk_level: string; count: number }[]

  const riskLevelMap: Record<string, number> = { safe: 0, warning: 0, margin_call: 0, force_liquidation: 0 }
  for (const item of clientsByRiskLevel) {
    riskLevelMap[item.risk_level] = item.count
  }

  const notificationStats = db.prepare(`
    SELECT type, status, COUNT(*) as count FROM notifications GROUP BY type, status
  `).all() as { type: string; status: string; count: number }[]

  const totalNotifications = db.prepare('SELECT COUNT(*) as cnt FROM notifications').get() as any
  const sentNotifications = db.prepare("SELECT COUNT(*) as cnt FROM notifications WHERE status = 'sent'").get() as any
  const settledNotifications = db.prepare("SELECT COUNT(*) as cnt FROM notifications WHERE status = 'settled'").get() as any

  const depositStats = db.prepare(`
    SELECT match_status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
    FROM deposits GROUP BY match_status
  `).all() as { match_status: string; count: number; total_amount: number }[]

  const totalDeposits = db.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total FROM deposits').get() as any
  const matchedDeposits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE match_status IN ('matched', 'partially_matched')").get() as any

  const highRiskClients = db.prepare(`
    SELECT c.id, c.name, c.account, c.equity, c.margin_used, c.risk_rate, c.risk_level
    FROM clients c
    WHERE c.risk_level != 'safe'
    ORDER BY c.risk_rate DESC
  `).all()

  const content = {
    generatedAt: now,
    riskDistribution: [
      { level: 'safe', count: riskLevelMap.safe || 0 },
      { level: 'warning', count: riskLevelMap.warning || 0 },
      { level: 'margin_call', count: riskLevelMap.margin_call || 0 },
      { level: 'force_liquidation', count: riskLevelMap.force_liquidation || 0 },
    ],
    notificationStats: [
      { name: '已发送', count: sentNotifications.cnt || 0 },
      { name: '已确认', count: (notificationStats.find(s => s.status === 'confirmed')?.count) || 0 },
      { name: '已撤回', count: (notificationStats.find(s => s.status === 'withdrawn')?.count) || 0 },
      { name: '已结清', count: settledNotifications.cnt || 0 },
    ],
    matchRate: {
      matched: matchedDeposits.total || 0,
      unmatched: (totalDeposits.total || 0) - (matchedDeposits.total || 0),
    },
    summary: {
      totalClients: (db.prepare('SELECT COUNT(*) as cnt FROM clients').get() as any).cnt,
      riskLevelDistribution: riskLevelMap,
      notificationStats: {
        total: totalNotifications.cnt,
        sent: sentNotifications.cnt,
        settled: settledNotifications.cnt,
      },
      depositStats: {
        total: totalDeposits.cnt,
        totalAmount: totalDeposits.total,
        matchedAmount: matchedDeposits.total,
        matchRate: totalDeposits.total > 0 ? Math.round((matchedDeposits.total / totalDeposits.total) * 10000) / 100 : 0,
      },
    },
    highRiskClients,
  }

  const reportId = uuidv4()
  const snapshotId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO reports (id, title, filter_params, generated_at, generated_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(reportId, title, JSON.stringify(filters), now, generatedBy)

    db.prepare(`
      INSERT INTO report_snapshots (id, report_id, content_json, snapshot_at)
      VALUES (?, ?, ?, ?)
    `).run(snapshotId, reportId, JSON.stringify(content), now)
  })
  transaction()

  return { id: reportId, title, filter_params: JSON.stringify(filters), generated_at: now, generated_by: generatedBy }
}

export function getReportHistory(): any[] {
  const db = getDb()
  return db.prepare('SELECT * FROM report_snapshots ORDER BY snapshot_at DESC').all()
}

export function getReportSnapshot(reportId: string): any {
  const db = getDb()

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as any
  if (!report) {
    throw new BusinessError(`报告 ${reportId} 不存在`, { severity: 'error' })
  }

  const snapshot = db.prepare('SELECT * FROM report_snapshots WHERE report_id = ? ORDER BY snapshot_at DESC LIMIT 1').get(reportId) as any
  if (!snapshot) {
    throw new BusinessError(`报告 ${reportId} 无快照数据`, { severity: 'error' })
  }

  return {
    ...report,
    content: {
      ...snapshot,
      content_json: snapshot.content_json,
    },
  }
}

export function exportReport(reportId: string, format: 'xlsx' | 'csv'): Buffer {
  const db = getDb()

  const reportData = getReportSnapshot(reportId)
  const content = JSON.parse(reportData.content.content_json)

  const wb = XLSX.utils.book_new()

  const summaryData = [
    ['指标', '数值'],
    ['客户总数', content.summary.totalClients],
    ['安全级别客户', content.summary.riskLevelDistribution.safe || 0],
    ['预警级别客户', content.summary.riskLevelDistribution.warning || 0],
    ['追保级别客户', content.summary.riskLevelDistribution.margin_call || 0],
    ['强平级别客户', content.summary.riskLevelDistribution.force_liquidation || 0],
    ['通知总数', content.summary.notificationStats.total],
    ['已发送通知', content.summary.notificationStats.sent],
    ['已结清通知', content.summary.notificationStats.settled],
    ['入金总额', content.summary.depositStats.totalAmount],
    ['已匹配金额', content.summary.depositStats.matchedAmount],
    ['匹配率(%)', content.summary.depositStats.matchRate],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, ws1, '汇总统计')

  if (content.highRiskClients && content.highRiskClients.length > 0) {
    const riskData = [
      ['客户名称', '账号', '权益', '已用保证金', '风险率(%)', '风险等级'],
      ...content.highRiskClients.map((c: any) => [c.name, c.account, c.equity, c.margin_used, c.risk_rate, c.risk_level]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(riskData)
    XLSX.utils.book_append_sheet(wb, ws2, '高风险客户')
  }

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(ws1)
    return Buffer.from('\uFEFF' + csvContent, 'utf-8')
  }

  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(xlsxBuffer)
}
