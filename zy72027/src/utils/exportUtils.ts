import type { GameSession, SettlementResult, RoundStat, ExportFormat } from '@/types'
import { formatTimestamp, formatDuration } from './timeUtils'

export function computeSettlement(session: GameSession): SettlementResult {
  const roundMap = new Map<number, { score: number; hits: number; misses: number; combo: number }>()

  let currentCombo = 0
  for (const choice of session.playerChoices) {
    const r = roundMap.get(choice.roundIndex) || { score: 0, hits: 0, misses: 0, combo: 0 }
    r.score += choice.score
    if (choice.action === 'hit') {
      r.hits += 1
      currentCombo += 1
      r.combo = Math.max(r.combo, currentCombo)
    } else {
      r.misses += 1
      currentCombo = 0
    }
    roundMap.set(choice.roundIndex, r)
  }

  const roundStats: RoundStat[] = []
  let totalScore = 0
  for (const [roundIndex, stat] of roundMap) {
    roundStats.push({ roundIndex, ...stat })
    totalScore += stat.score
  }
  roundStats.sort((a, b) => a.roundIndex - b.roundIndex)

  const grade = getGrade(totalScore)
  const suggestions = generateSuggestions(session, roundStats, totalScore)

  return {
    sessionId: session.id,
    totalScore,
    grade,
    endReason: session.endReason,
    roundStats,
    suggestions,
    generatedAt: Date.now(),
  }
}

function getGrade(score: number): string {
  if (score >= 2000) return 'S'
  if (score >= 1500) return 'A'
  if (score >= 1000) return 'B'
  if (score >= 500) return 'C'
  return 'D'
}

function generateSuggestions(session: GameSession, roundStats: RoundStat[], _totalScore: number): string[] {
  const suggestions: string[] = []
  const missRounds = roundStats.filter(r => r.misses > 0)
  const totalMisses = missRounds.length

  if (totalMisses > 0) {
    const roundList = missRounds.map(r => `第${r.roundIndex}回合`).join('、')
    suggestions.push(`有${totalMisses}个回合出现失误（${roundList}），建议对这些回合涉及的音符类型做针对性复习。`)
  }

  const wrongChoices = session.playerChoices.filter(c => c.action === 'wrong')
  if (wrongChoices.length > 0) {
    suggestions.push(`有${wrongChoices.length}次错误按键，可能是音符辨识问题，建议放慢练习速度，先提高准确率再提速。`)
  }

  if (session.totalPausedDuration > 10000) {
    const pausedSec = Math.round(session.totalPausedDuration / 1000)
    suggestions.push(`本局累计暂停${pausedSec}秒，暂停时间较长可能影响节奏感。建议暂停时长控制在2分钟以内，恢复后先做一次热身再继续。`)
  }

  const maxCombo = Math.max(...roundStats.map(r => r.combo), 0)
  if (maxCombo >= 5) {
    suggestions.push(`最高连击${maxCombo}次，节奏感不错！可以尝试更高难度的关卡。`)
  }

  if (suggestions.length === 0) {
    suggestions.push('表现优异，无特殊建议。继续保持！')
  }

  return suggestions
}

export function generateExportContent(
  sessions: GameSession[],
  settlements: SettlementResult[],
  format: ExportFormat
): string {
  if (format === 'markdown') {
    return generateMarkdown(sessions, settlements)
  }
  return generatePlainText(sessions, settlements)
}

function generateMarkdown(sessions: GameSession[], settlements: SettlementResult[]): string {
  const lines: string[] = []
  lines.push('# 量子音符弹幕 - 成绩报告')
  lines.push('')
  lines.push(`生成时间：${formatTimestamp(Date.now())}`)
  lines.push('---')
  lines.push('')

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    const settlement = settlements[i]

    lines.push(`## 第${i + 1}局：${session.levelParams.name}`)
    lines.push('')
    lines.push(`- **关卡**：${session.levelParams.name}（${difficultyLabel(session.levelParams.difficulty)}）`)
    lines.push(`- **状态**：${statusLabel(session.status)}`)
    lines.push(`- **总回合**：${session.currentRound}`)
    lines.push(`- **开始时间**：${session.startedAt ? formatTimestamp(session.startedAt) : '未开始'}`)
    lines.push(`- **结束时间**：${session.endedAt ? formatTimestamp(session.endedAt) : '进行中'}`)
    lines.push(`- **累计暂停**：${formatDuration(session.totalPausedDuration)}`)
    lines.push(`- **结束原因**：${session.endReason || '—'}`)
    lines.push(`- **数据来源**：${session.source}`)
    lines.push(`- **录入时间**：${formatTimestamp(session.createdAt)}`)
    lines.push('')

    if (settlement) {
      lines.push('### 结算')
      lines.push('')
      lines.push(`- **总分**：${settlement.totalScore}`)
      lines.push(`- **评级**：${settlement.grade}`)
      lines.push(`- **结算原因**：${settlement.endReason}`)
      lines.push('')
      lines.push('### 回合明细')
      lines.push('')
      lines.push('| 回合 | 得分 | 命中 | 失误 | 最大连击 |')
      lines.push('|------|------|------|------|----------|')
      for (const stat of settlement.roundStats) {
        lines.push(`| ${stat.roundIndex} | ${stat.score} | ${stat.hits} | ${stat.misses} | ${stat.combo} |`)
      }
      lines.push('')
      lines.push('### 处理建议')
      lines.push('')
      for (const s of settlement.suggestions) {
        lines.push(`- ${s}`)
      }
      lines.push('')
    }

    if (session.notes.length > 0) {
      lines.push('### 评分备注')
      lines.push('')
      for (const note of session.notes) {
        const tag = note.isSupplementary ? '【补录】' : '【原始】'
        lines.push(`- ${tag} 第${note.roundIndex}回合（${note.author}，${formatTimestamp(note.createdAt)}）：${note.content}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

function generatePlainText(sessions: GameSession[], settlements: SettlementResult[]): string {
  const lines: string[] = []
  lines.push('═══════════════════════════════════════')
  lines.push('  量子音符弹幕 - 成绩报告')
  lines.push(`  生成时间：${formatTimestamp(Date.now())}`)
  lines.push('═══════════════════════════════════════')
  lines.push('')

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    const settlement = settlements[i]

    lines.push(`【第${i + 1}局】${session.levelParams.name}`)
    lines.push(`  关卡：${session.levelParams.name}（${difficultyLabel(session.levelParams.difficulty)}）`)
    lines.push(`  总回合：${session.currentRound}`)
    lines.push(`  开始：${session.startedAt ? formatTimestamp(session.startedAt) : '未开始'}`)
    lines.push(`  结束：${session.endedAt ? formatTimestamp(session.endedAt) : '进行中'}`)
    lines.push(`  暂停：${formatDuration(session.totalPausedDuration)}`)
    lines.push(`  结束原因：${session.endReason || '—'}`)
    lines.push(`  数据来源：${session.source}`)
    lines.push(`  录入时间：${formatTimestamp(session.createdAt)}`)
    lines.push('')

    if (settlement) {
      lines.push('  ── 结算 ──')
      lines.push(`  总分：${settlement.totalScore}  评级：${settlement.grade}  原因：${settlement.endReason}`)
      lines.push('')
      lines.push('  回合明细：')
      for (const stat of settlement.roundStats) {
        lines.push(`    第${stat.roundIndex}回合：得分${stat.score}  命中${stat.hits}  失误${stat.misses}  最大连击${stat.combo}`)
      }
      lines.push('')
      lines.push('  处理建议：')
      for (const s of settlement.suggestions) {
        lines.push(`    · ${s}`)
      }
      lines.push('')
    }

    if (session.notes.length > 0) {
      lines.push('  ── 评分备注 ──')
      for (const note of session.notes) {
        const tag = note.isSupplementary ? '[补录]' : '[原始]'
        lines.push(`    ${tag} 第${note.roundIndex}回合（${note.author}，${formatTimestamp(note.createdAt)}）`)
        lines.push(`    ${note.content}`)
      }
      lines.push('')
    }

    lines.push('───────────────────────────────────────')
    lines.push('')
  }

  return lines.join('\n')
}

function difficultyLabel(d: string): string {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[d] || d
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { idle: '未开始', playing: '进行中', paused: '已暂停', ended: '已结束' }
  return map[s] || s
}
