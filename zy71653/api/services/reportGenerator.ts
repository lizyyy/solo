import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type { AllocationSuggestion } from './allocationEngine.js'

export interface ReportConfig {
  format: 'markdown' | 'json'
  campaignId?: string
  includeExceptions?: boolean
  includeHumanTips?: boolean
}

export function generateReport(config: ReportConfig): { id: string; content: string; humanTips?: string } {
  const channels = db.prepare(`
    SELECT c.*, COALESCE(SUM(cv.conversions), 0) as total_conversions,
      COALESCE(SUM(cv.cost), 0) as total_cost,
      COALESCE(SUM(cv.revenue), 0) as total_revenue
    FROM channels c
    LEFT JOIN conversions cv ON cv.channel_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all() as any[]

  const allocations = db.prepare(`
    SELECT a.*, c.name as channel_name FROM allocations a
    LEFT JOIN channels c ON a.channel_id = c.id
    WHERE a.status IN ('pending', 'applied')
    ORDER BY a.created_at DESC
  `).all() as any[]

  let exceptions: any[] = []
  if (config.includeExceptions) {
    exceptions = db.prepare(`
      SELECT * FROM exceptions WHERE status = 'open' ORDER BY created_at DESC
    `).all() as any[]
  }

  let content: string
  let humanTips: string | undefined

  if (config.format === 'markdown') {
    content = generateMarkdown(channels, allocations, exceptions)
    if (config.includeHumanTips) {
      humanTips = generateHumanTipsSummary(
        allocations.map(a => ({
          channelName: a.channel_name,
          suggestedBudget: a.suggested_budget,
          actualBudget: a.actual_budget,
          changePercent: a.actual_budget && a.suggested_budget
            ? ((a.actual_budget - a.suggested_budget) / a.suggested_budget) * 100
            : 0,
        })),
        exceptions
      )
    }
  } else {
    const jsonData = {
      generatedAt: new Date().toISOString(),
      channels,
      allocations,
      exceptions: config.includeExceptions ? exceptions : undefined,
    }
    content = JSON.stringify(jsonData, null, 2)
    if (config.includeHumanTips) {
      humanTips = generateHumanTipsSummary(
        allocations.map(a => ({
          channelName: a.channel_name,
          suggestedBudget: a.suggested_budget,
          actualBudget: a.actual_budget,
          changePercent: a.actual_budget && a.suggested_budget
            ? ((a.actual_budget - a.suggested_budget) / a.suggested_budget) * 100
            : 0,
        })),
        exceptions
      )
    }
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO reports (id, format, content, human_tips, config_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, config.format, content, humanTips || null, JSON.stringify(config), now)

  return { id, content, humanTips }
}

function generateMarkdown(channels: any[], allocations: any[], exceptions: any[]): string {
  const lines: string[] = []

  lines.push('# 短视频广告预算分配报告')
  lines.push('')
  lines.push(`生成时间: ${new Date().toISOString()}`)
  lines.push('')

  lines.push('## 渠道概览')
  lines.push('')
  lines.push('| 渠道 | 平台 | 转化率 | 疲劳度 | 总转化数 | 总花费 | 总收入 | ROI |')
  lines.push('|------|------|--------|--------|----------|--------|--------|-----|')
  for (const ch of channels) {
    const roi = ch.total_cost > 0 ? (ch.total_revenue / ch.total_cost).toFixed(2) : '-'
    lines.push(`| ${ch.name} | ${ch.platform} | ${(ch.conversion_rate * 100).toFixed(1)}% | ${ch.fatigue_score.toFixed(2)} | ${ch.total_conversions} | ¥${ch.total_cost.toLocaleString()} | ¥${ch.total_revenue.toLocaleString()} | ${roi} |`)
  }
  lines.push('')

  if (allocations.length > 0) {
    lines.push('## 预算分配')
    lines.push('')
    lines.push('| 渠道 | 建议预算 | 实际预算 | 状态 | 版本 |')
    lines.push('|------|----------|----------|------|------|')
    for (const alloc of allocations) {
      lines.push(`| ${alloc.channel_name} | ¥${alloc.suggested_budget.toLocaleString()} | ¥${(alloc.actual_budget || 0).toLocaleString()} | ${alloc.status} | v${alloc.version} |`)
    }
    lines.push('')
  }

  if (exceptions.length > 0) {
    lines.push('## 异常提醒')
    lines.push('')
    for (const ex of exceptions) {
      lines.push(`- **[${ex.severity}]** ${ex.human_tip}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function generateHumanTipsSummary(
  allocations: { channelName: string; suggestedBudget: number; actualBudget: number; changePercent: number }[],
  exceptions: any[]
): string {
  const lines: string[] = []
  lines.push('📊 今日预算分配摘要:')
  lines.push('')

  const sortedAllocations = [...allocations].sort((a, b) => b.suggestedBudget - a.suggestedBudget)

  for (const alloc of sortedAllocations) {
    const direction = alloc.changePercent > 0 ? '↑' : alloc.changePercent < 0 ? '↓' : '→'
    const absPercent = Math.abs(alloc.changePercent).toFixed(0)
    let note = ''
    if (alloc.changePercent < -10) {
      note = ' — 转化率下滑，疲劳度偏高'
    } else if (alloc.changePercent > 10) {
      note = ' — 稳定增长渠道'
    }

    lines.push(`· ${alloc.channelName}: ¥${alloc.suggestedBudget.toLocaleString()} (${direction}${absPercent}%)${note}`)
  }

  if (exceptions.length > 0) {
    lines.push('')
    const typeCount: Record<string, number> = {}
    for (const ex of exceptions) {
      const label = ex.type === 'budget_overspend' ? '预算超花' :
        ex.type === 'conversion_delay' ? '转化延迟' :
        ex.type === 'fatigue_missing' ? '疲劳度缺失' :
        ex.type === 'duplicate_import' ? '重复导入' : ex.type
      typeCount[label] = (typeCount[label] || 0) + 1
    }
    const exceptionParts = Object.entries(typeCount).map(([type, count]) => `${count}条${type}`)
    lines.push(`⚠️ ${exceptions.length}条异常需处理: ${exceptionParts.join(', ')}`)
  }

  return lines.join('\n')
}
