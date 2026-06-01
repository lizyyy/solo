import type {
  RoundRecord,
  DeductionEntry,
  AuditEntry,
  ScoringRule,
  LevelConfig,
} from '@/types'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function evaluateChoice(
  choice: string | null,
  correctAnswer: string,
  rules: ScoringRule[],
  isDuplicate: boolean,
  source: RoundRecord['source']
): { score: number; deductions: Omit<DeductionEntry, 'id' | 'roundId'>[] } {
  const deductions: Omit<DeductionEntry, 'id' | 'roundId'>[] = []
  let score = 100

  if (source === 'timeout') {
    const rule = rules.find((r) => r.id === 'timeout')
    if (rule) {
      deductions.push({ reason: rule.reason, points: rule.deduction, detail: rule.detail })
      score -= rule.deduction
    }
  }

  if (choice === null) {
    const rule = rules.find((r) => r.id === 'no-choice')
    if (rule) {
      deductions.push({ reason: rule.reason, points: rule.deduction, detail: rule.detail })
      score -= rule.deduction
    }
  } else if (choice !== correctAnswer) {
    const rule = rules.find((r) => r.id === 'wrong-choice')
    if (rule) {
      deductions.push({ reason: rule.reason, points: rule.deduction, detail: rule.detail })
      score -= rule.deduction
    }
  }

  if (isDuplicate && choice !== null) {
    const rule = rules.find((r) => r.id === 'duplicate-choice')
    if (rule) {
      deductions.push({ reason: rule.reason, points: rule.deduction, detail: rule.detail })
      score -= rule.deduction
    }
  }

  return { score: Math.max(score, 0), deductions }
}

export function detectDuplicate(
  records: RoundRecord[],
  currentRound: number,
  choice: string | null
): boolean {
  if (choice === null) return false
  const prevRecord = records.find((r) => r.roundNumber === currentRound - 1)
  return prevRecord !== undefined && prevRecord.playerChoice === choice
}

export function createRoundRecord(
  challengeId: string,
  roundNumber: number,
  choice: string | null,
  correctAnswer: string,
  source: RoundRecord['source'],
  isDuplicate: boolean,
  rules: ScoringRule[]
): { record: RoundRecord; deductions: DeductionEntry[] } {
  const { score, deductions: rawDeductions } = evaluateChoice(
    choice,
    correctAnswer,
    rules,
    isDuplicate,
    source
  )

  const recordId = generateId()
  const record: RoundRecord = {
    id: recordId,
    challengeId,
    roundNumber,
    playerChoice: choice,
    correctAnswer,
    score,
    choiceTimestamp: source === 'timeout' ? null : isoNow(),
    source,
    isDuplicate,
  }

  const deductions: DeductionEntry[] = rawDeductions.map((d) => ({
    id: generateId(),
    roundId: recordId,
    ...d,
  }))

  return { record, deductions }
}

export function createAuditEntries(
  roundId: string,
  action: string,
  source: AuditEntry['source'],
  operator: string,
  snapshot: Record<string, unknown>
): AuditEntry {
  return {
    id: generateId(),
    roundId,
    source,
    processedAt: isoNow(),
    operator,
    action,
    snapshot,
  }
}

export function computeTotalScore(records: RoundRecord[]): number {
  if (records.length === 0) return 0
  return Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length)
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function exportAsText(
  level: LevelConfig,
  records: RoundRecord[],
  deductions: DeductionEntry[],
  audits: AuditEntry[],
  instance: { id: string; createdAt: string; completedAt: string | null; elapsedSeconds: number }
): string {
  const totalScore = computeTotalScore(records)
  const lines: string[] = []

  lines.push('═══════════════════════════════════════')
  lines.push('  电磁炮校准挑战 — 成绩报告')
  lines.push('═══════════════════════════════════════')
  lines.push('')
  lines.push(`关卡：${level.name}`)
  lines.push(`挑战ID：${instance.id}`)
  lines.push(`开始时间：${new Date(instance.createdAt).toLocaleString('zh-CN')}`)
  lines.push(`结束时间：${instance.completedAt ? new Date(instance.completedAt).toLocaleString('zh-CN') : '未完成'}`)
  lines.push(`总用时：${formatElapsed(instance.elapsedSeconds)}`)
  lines.push(`综合得分：${totalScore} 分`)
  lines.push('')

  lines.push('───────────────────────────────────────')
  lines.push('  各回合详情')
  lines.push('───────────────────────────────────────')

  for (const record of records) {
    const param = level.parameters.find((p) => p.roundNumber === record.roundNumber)
    lines.push('')
    lines.push(`【第 ${record.roundNumber} 回合】`)
    if (param) {
      lines.push(`  参数：频率 ${param.frequency}GHz / 功率 ${param.power}kW / 角度 ${param.angle}° / 温度 ${param.temperature}℃`)
    }
    const choiceLabel = record.playerChoice
      ? level.options[record.roundNumber]?.find((o) => o.startsWith(record.playerChoice!)) ?? record.playerChoice
      : '（未选择）'
    const correctLabel = level.options[record.roundNumber]?.find((o) => o.startsWith(record.correctAnswer)) ?? record.correctAnswer
    lines.push(`  学员选择：${choiceLabel}`)
    lines.push(`  正确答案：${correctLabel}`)
    lines.push(`  得分：${record.score} 分`)
    if (record.source === 'timeout') lines.push(`  ⚠ 超时`)
    if (record.isDuplicate) lines.push(`  ⚠ 重复选择`)
    if (record.playerChoice === null) lines.push(`  ⚠ 未选择`)

    const roundDeductions = deductions.filter((d) => d.roundId === record.id)
    for (const d of roundDeductions) {
      lines.push(`  扣分：-${d.points} 分（${d.reason}：${d.detail}）`)
    }
  }

  lines.push('')
  lines.push('───────────────────────────────────────')
  lines.push('  审计追踪')
  lines.push('───────────────────────────────────────')
  for (const audit of audits) {
    lines.push(`  [${new Date(audit.processedAt).toLocaleString('zh-CN')}] ${audit.source} | ${audit.operator} | ${audit.action}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════')
  lines.push('  报告生成时间：' + new Date().toLocaleString('zh-CN'))
  lines.push('═══════════════════════════════════════')

  return lines.join('\n')
}
