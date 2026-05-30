import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'

export interface ExceptionResult {
  id: string
  type: string
  severity: string
  message: string
  humanTip: string
  suggestion: string
  relatedId: string | null
}

export function detectBudgetOverspend(): ExceptionResult[] {
  const results: ExceptionResult[] = []

  const allocations = db.prepare(`
    SELECT a.*, c.name as channel_name, c.conversion_rate,
      COALESCE(SUM(cv.cost), 0) as total_spent
    FROM allocations a
    LEFT JOIN channels c ON a.channel_id = c.id
    LEFT JOIN conversions cv ON cv.channel_id = a.channel_id
    WHERE a.status IN ('pending', 'applied')
    GROUP BY a.id
  `).all() as any[]

  for (const alloc of allocations) {
    const budget = alloc.actual_budget || alloc.suggested_budget
    if (budget > 0 && alloc.total_spent > budget * 1.1) {
      const overPercent = Math.round(((alloc.total_spent - budget) / budget) * 100)
      results.push({
        id: uuidv4(),
        type: 'budget_overspend',
        severity: 'high',
        message: `${alloc.channel_name}渠道预算已超花${overPercent}%`,
        humanTip: `⚠️ ${alloc.channel_name}渠道预算已超花${overPercent}%，建议人工确认是否追加或回调`,
        suggestion: `建议将${alloc.channel_name}渠道预算回调至原预算的105%以内，或将超出部分计入下期`,
        relatedId: alloc.channel_id,
      })
    }
  }

  return results
}

export function detectConversionDelay(): ExceptionResult[] {
  const results: ExceptionResult[] = []

  const delayedConversions = db.prepare(`
    SELECT cv.*, c.name as channel_name
    FROM conversions cv
    LEFT JOIN channels c ON cv.channel_id = c.id
    WHERE cv.delay_hours > 24
    ORDER BY cv.delay_hours DESC
  `).all() as any[]

  const channelMap = new Map<string, any>()
  for (const conv of delayedConversions) {
    if (!channelMap.has(conv.channel_id)) {
      channelMap.set(conv.channel_id, conv)
    }
  }

  for (const [, conv] of channelMap) {
    results.push({
      id: uuidv4(),
      type: 'conversion_delay',
      severity: 'medium',
      message: `${conv.channel_name}渠道转化数据延迟${conv.delay_hours}小时`,
      humanTip: `⚠️ ${conv.channel_name}渠道转化数据延迟超过24小时(${conv.delay_hours}h)，可能影响分配决策准确性`,
      suggestion: `建议暂停基于${conv.channel_name}实时数据的自动分配，切换至人工审核模式`,
      relatedId: conv.channel_id,
    })
  }

  return results
}

export function detectFatigueMissing(): ExceptionResult[] {
  const results: ExceptionResult[] = []

  const channels = db.prepare(`
    SELECT * FROM channels WHERE fatigue_score = 0 OR fatigue_score IS NULL
  `).all() as any[]

  for (const ch of channels) {
    results.push({
      id: uuidv4(),
      type: 'fatigue_missing',
      severity: 'low',
      message: `${ch.name}渠道疲劳度数据缺失`,
      humanTip: `⚠️ ${ch.name}渠道疲劳度数据为0或缺失，可能未正确采集，建议检查数据源`,
      suggestion: `建议检查${ch.name}数据采集接口是否正常，手动补充疲劳度评分`,
      relatedId: ch.id,
    })
  }

  return results
}

export function detectDuplicateImport(): ExceptionResult[] {
  const results: ExceptionResult[] = []

  const duplicates = db.prepare(`
    SELECT name, COUNT(*) as count FROM channels GROUP BY name HAVING COUNT(*) > 1
  `).all() as any[]

  for (const dup of duplicates) {
    results.push({
      id: uuidv4(),
      type: 'duplicate_import',
      severity: 'medium',
      message: `发现重复渠道名称: ${dup.name} (${dup.count}条记录)`,
      humanTip: `⚠️ 发现${dup.count}条名为"${dup.name}"的渠道记录，可能为重复导入`,
      suggestion: `建议合并重复渠道数据，保留最新记录`,
      relatedId: null,
    })
  }

  return results
}

export function runAllChecks(): ExceptionResult[] {
  const allResults: ExceptionResult[] = [
    ...detectBudgetOverspend(),
    ...detectConversionDelay(),
    ...detectFatigueMissing(),
    ...detectDuplicateImport(),
  ]

  if (allResults.length > 0) {
    const insertException = db.prepare(`
      INSERT INTO exceptions (id, type, severity, message, human_tip, suggestion, status, related_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `)

    const now = new Date().toISOString()
    const transaction = db.transaction(() => {
      for (const ex of allResults) {
        const existing = db.prepare(`
          SELECT id FROM exceptions
          WHERE type = ? AND related_id = ? AND status = 'open'
        `).get(ex.type, ex.relatedId) as any

        if (!existing) {
          insertException.run(ex.id, ex.type, ex.severity, ex.message, ex.humanTip, ex.suggestion, ex.relatedId, now)
        }
      }
    })

    transaction()
  }

  return allResults
}
