import type { Clue, BayesCalculation } from '../types'

export function generateExplanation(
  clue: Clue,
  calculations: BayesCalculation[],
  isDuplicate: boolean,
  isReversed: boolean
): string {
  const parts: string[] = []

  parts.push(clueIntro(clue))

  const sorted = [...calculations].sort((a, b) => b.posterior - a.prior - (a.posterior - a.prior))

  const increased = sorted.filter((c) => c.posterior > c.prior + 0.01)
  const decreased = sorted.filter((c) => c.posterior < c.prior - 0.01)

  if (increased.length > 0) {
    parts.push(suspectChangeSummary(increased, '上升'))
  }
  if (decreased.length > 0) {
    parts.push(suspectChangeSummary(decreased, '下降'))
  }

  if (isDuplicate) {
    parts.push(
      `⚠️ 这条线索与已翻出的证据存在关联，因此概率更新时不做归一化处理，而是按翻牌顺序累积记录，这样你可以看出证据之间的影响先后顺序。`
    )
  }

  if (isReversed) {
    parts.push(
      `🔄 此线索使用了条件概率反用策略——当证据与洗清嫌疑的方向一致时，先验概率作为补充证据保留在计算明细中，避免概率被过度归零。`
    )
  }

  calculations.forEach((c) => {
    if (c.isPriorSupplement && c.priorSupplementNote) {
      parts.push(c.priorSupplementNote)
    }
  })

  if (clue.consistencyNote) {
    parts.push(`📌 补充说明：${clue.consistencyNote}`)
  }

  return parts.join('\n\n')
}

function clueIntro(clue: Clue): string {
  const typeMap: Record<string, string> = {
    incriminating: '有罪线索（增加某人的嫌疑）',
    exonerating: '洗白线索（降低某人的嫌疑）',
    neutral: '中性线索（对不同嫌疑人的影响不同）',
  }
  return `翻开了「${clue.title}」——${clue.description}\n\n类型：${typeMap[clue.type] || '未知'}`
}

function suspectChangeSummary(
  calcs: BayesCalculation[],
  direction: '上升' | '下降'
): string {
  return calcs
    .map((c) => {
      const change = Math.abs(c.posterior - c.prior) * 100
      const arrow = direction === '上升' ? '📈' : '📉'
      const priorPct = (c.prior * 100).toFixed(1)
      const postPct = (c.posterior * 100).toFixed(1)
      if (direction === '上升') {
        return `${arrow} ${c.suspectName}的嫌疑概率从 ${priorPct}% 上升到 ${postPct}%（+${change.toFixed(1)}%），因为这条线索更可能在 TA 有罪的情况下出现（似然度 ${(c.likelihood * 100).toFixed(0)}%），远高于其他嫌疑人。`
      } else {
        return `${arrow} ${c.suspectName}的嫌疑概率从 ${priorPct}% 下降到 ${postPct}%（-${change.toFixed(1)}%），因为这条线索在 TA 有罪时出现的可能性很低（似然度仅 ${(c.likelihood * 100).toFixed(0)}%），更像是无辜者会遇到的情况。`
      }
    })
    .join('\n\n')
}
