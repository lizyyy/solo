import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'

export interface AllocationSuggestion {
  channelId: string
  channelName: string
  currentBudget: number
  suggestedBudget: number
  changePercent: number
  metrics: {
    conversionRate: number
    fatigueScore: number
    spendVelocity: number
    timeWeight: number
  }
  explanation: string
  confidence: number
}

export interface ScenarioComparison {
  scenarioA: { label: string; suggestions: AllocationSuggestion[] }
  scenarioB: { label: string; suggestions: AllocationSuggestion[] }
  diff: { channelId: string; channelName: string; budgetDiff: number; percentDiff: number }[]
}

function getRemainingDays(periodEnd: string): number {
  const end = new Date(periodEnd)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function generateExplanation(
  channelName: string,
  conversionRate: number,
  fatigueScore: number,
  timeWeight: number,
  changePercent: number
): string {
  const parts: string[] = []
  if (conversionRate > 0.04) {
    parts.push('转化率较高')
  } else if (conversionRate < 0.025) {
    parts.push('转化率偏低')
  } else {
    parts.push('转化率中等')
  }

  if (fatigueScore > 0.6) {
    parts.push('疲劳度偏高，需注意素材更新')
  } else if (fatigueScore < 0.3) {
    parts.push('疲劳度低，增长空间较大')
  }

  if (timeWeight > 0.8) {
    parts.push('临近活动节点，时间权重较高')
  }

  const direction = changePercent > 0 ? '增加' : changePercent < 0 ? '减少' : '维持'
  const absPercent = Math.abs(changePercent).toFixed(1)

  return `${channelName}: 建议${direction}${absPercent}%预算 — ${parts.join('，')}`
}

export function generateSuggestions(campaignId: string, totalBudget: number): AllocationSuggestion[] {
  const channels = db.prepare(`
    SELECT c.* FROM channels c
    WHERE c.status = 'active'
  `).all() as any[]

  if (channels.length === 0) return []

  const budget = db.prepare(`
    SELECT * FROM budgets WHERE campaign_id = ? ORDER BY period_end DESC LIMIT 1
  `).get(campaignId) as any

  const maxRemainingDays = channels.reduce((max, ch) => {
    if (!budget) return max
    const days = getRemainingDays(budget.period_end)
    return Math.max(max, days)
  }, 0)

  const remainingDays = budget ? getRemainingDays(budget.period_end) : 0

  const existingAllocations = db.prepare(`
    SELECT channel_id, suggested_budget as current_budget FROM allocations
    WHERE campaign_id = ? AND status IN ('pending', 'applied')
    ORDER BY created_at DESC
  `).all(campaignId) as any[]

  const currentBudgetMap = new Map<string, number>()
  for (const alloc of existingAllocations) {
    if (!currentBudgetMap.has(alloc.channel_id)) {
      currentBudgetMap.set(alloc.channel_id, alloc.current_budget)
    }
  }

  const weightedChannels = channels.map(ch => {
    const timeWeight = maxRemainingDays > 0 ? remainingDays / maxRemainingDays : 0
    const weight =
      ch.conversion_rate * 0.4 +
      (1 - ch.fatigue_score) * 0.35 +
      timeWeight * 0.25

    return {
      ...ch,
      weight,
      timeWeight,
    }
  })

  const totalWeight = weightedChannels.reduce((sum, ch) => sum + ch.weight, 0)

  const suggestions: AllocationSuggestion[] = weightedChannels.map(ch => {
    const proportion = totalWeight > 0 ? ch.weight / totalWeight : 1 / weightedChannels.length
    const suggestedBudget = Math.round(totalBudget * proportion)
    const currentBudget = currentBudgetMap.get(ch.id) || suggestedBudget
    const changePercent = currentBudget > 0 ? ((suggestedBudget - currentBudget) / currentBudget) * 100 : 0

    const confidence = Math.min(
      1,
      (ch.conversion_rate * 10 + (1 - ch.fatigue_score) * 0.5 + 0.3)
    )

    return {
      channelId: ch.id,
      channelName: ch.name,
      currentBudget,
      suggestedBudget,
      changePercent: Math.round(changePercent * 10) / 10,
      metrics: {
        conversionRate: ch.conversion_rate,
        fatigueScore: ch.fatigue_score,
        spendVelocity: ch.spend_velocity,
        timeWeight: ch.timeWeight,
      },
      explanation: generateExplanation(
        ch.name,
        ch.conversion_rate,
        ch.fatigue_score,
        ch.timeWeight,
        changePercent
      ),
      confidence: Math.round(confidence * 100) / 100,
    }
  })

  return suggestions
}

export function applyAllocation(
  campaignId: string,
  suggestions: AllocationSuggestion[],
  overrides?: Record<string, { budget: number; reason: string }>
): any[] {
  const insertAllocation = db.prepare(`
    INSERT INTO allocations (id, campaign_id, channel_id, suggested_budget, actual_budget, override_reason, version, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, '1', 'applied', ?)
  `)

  const insertVersion = db.prepare(`
    INSERT INTO allocation_versions (id, allocation_id, version_number, budget_value, change_reason, created_at)
    VALUES (?, ?, '1', ?, '初始分配', ?)
  `)

  const now = new Date().toISOString()
  const results: any[] = []

  const transaction = db.transaction(() => {
    for (const suggestion of suggestions) {
      const id = uuidv4()
      const override = overrides?.[suggestion.channelId]
      const actualBudget = override ? override.budget : suggestion.suggestedBudget
      const overrideReason = override ? override.reason : null

      insertAllocation.run(
        id,
        campaignId,
        suggestion.channelId,
        suggestion.suggestedBudget,
        actualBudget,
        overrideReason,
        now
      )

      insertVersion.run(uuidv4(), id, actualBudget, now)

      results.push({
        id,
        campaignId,
        channelId: suggestion.channelId,
        channelName: suggestion.channelName,
        suggestedBudget: suggestion.suggestedBudget,
        actualBudget,
        overrideReason,
      })
    }
  })

  transaction()
  return results
}

export function rollbackAllocation(allocationId: string, reason: string): any {
  const allocation = db.prepare(`
    SELECT a.*, c.name as channel_name FROM allocations a
    LEFT JOIN channels c ON a.channel_id = c.id
    WHERE a.id = ?
  `).get(allocationId) as any

  if (!allocation) {
    throw new Error('分配记录不存在')
  }

  const versions = db.prepare(`
    SELECT * FROM allocation_versions
    WHERE allocation_id = ?
    ORDER BY created_at DESC
  `).all(allocationId) as any[]

  if (versions.length < 2) {
    throw new Error('没有可回退的历史版本')
  }

  const currentVersion = versions[0]
  const previousVersion = versions[1]

  const newVersionNumber = (parseInt(currentVersion.version_number) + 1).toString()
  const now = new Date().toISOString()

  const insertVersion = db.prepare(`
    INSERT INTO allocation_versions (id, allocation_id, version_number, budget_value, change_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const updateAllocation = db.prepare(`
    UPDATE allocations SET actual_budget = ?, version = ?, status = 'rolled_back' WHERE id = ?
  `)

  const transaction = db.transaction(() => {
    insertVersion.run(uuidv4(), allocationId, newVersionNumber, previousVersion.budget_value, `回退: ${reason}`, now)
    updateAllocation.run(previousVersion.budget_value, newVersionNumber, allocationId)
  })

  transaction()

  return {
    allocationId,
    channelName: allocation.channel_name,
    rolledBackFrom: currentVersion.budget_value,
    rolledBackTo: previousVersion.budget_value,
    newVersion: newVersionNumber,
    reason,
  }
}

export function compareScenarios(
  campaignId: string,
  scenarioAOverrides: Record<string, { budget: number; reason: string }>,
  scenarioBOverrides: Record<string, { budget: number; reason: string }>
): ScenarioComparison {
  const baseSuggestions = generateSuggestions(campaignId, getTotalBudget(campaignId))

  const scenarioASuggestions = baseSuggestions.map(s => {
    const override = scenarioAOverrides[s.channelId]
    if (override) {
      return { ...s, suggestedBudget: override.budget, actualBudget: override.budget }
    }
    return s
  })

  const scenarioBSuggestions = baseSuggestions.map(s => {
    const override = scenarioBOverrides[s.channelId]
    if (override) {
      return { ...s, suggestedBudget: override.budget, actualBudget: override.budget }
    }
    return s
  })

  const diff = baseSuggestions.map((s, i) => ({
    channelId: s.channelId,
    channelName: s.channelName,
    budgetDiff: scenarioASuggestions[i].suggestedBudget - scenarioBSuggestions[i].suggestedBudget,
    percentDiff:
      scenarioBSuggestions[i].suggestedBudget > 0
        ? Math.round(
            ((scenarioASuggestions[i].suggestedBudget - scenarioBSuggestions[i].suggestedBudget) /
              scenarioBSuggestions[i].suggestedBudget) *
              100 *
              10
          ) / 10
        : 0,
  }))

  return {
    scenarioA: { label: '方案A', suggestions: scenarioASuggestions },
    scenarioB: { label: '方案B', suggestions: scenarioBSuggestions },
    diff,
  }
}

function getTotalBudget(campaignId: string): number {
  const budget = db.prepare(`
    SELECT total_budget FROM budgets WHERE campaign_id = ? ORDER BY period_end DESC LIMIT 1
  `).get(campaignId) as any
  return budget ? budget.total_budget : 0
}
