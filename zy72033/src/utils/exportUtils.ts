import type { MatchData, TeamRound } from "@/types"

export function exportCSV(data: MatchData): string {
  const { match, teams, rounds, teamRounds } = data
  const header = ["组名", "总得分", "是否异常", "异常说明", "数据来源", "原始备注"]
  const roundHeaders = rounds.flatMap((r) => [
    `第${r.roundNumber}轮选择`,
    `第${r.roundNumber}轮消耗`,
    `第${r.roundNumber}轮剩余`,
    `第${r.roundNumber}轮扣分`,
    `第${r.roundNumber}轮扣分原因`,
  ])
  const allHeaders = [...header.slice(0, 2), ...roundHeaders, ...header.slice(2)]

  const rows = teams.map((team) => {
    const teamRecords = teamRounds.filter((tr) => tr.teamId === team.id)
    const sortedRecords = teamRecords.sort((a, b) => {
      const ra = rounds.find((r) => r.id === a.roundId)
      const rb = rounds.find((r) => r.id === b.roundId)
      return (ra?.roundNumber ?? 0) - (rb?.roundNumber ?? 0)
    })

    const roundCells = sortedRecords.flatMap((tr) => [
      String(tr.fuelChoice),
      String(tr.resourceUsed),
      String(tr.resourceRemaining),
      String(tr.deduction),
      tr.deductionReason,
    ])

    const sourceMap: Record<string, string> = {
      normal: "正常录入",
      projection_screen: "投影大屏补录",
      manual_correction: "手动修正",
    }

    const hasResourceOverspend = teamRecords.some(tr => tr.resourceRemaining < 0)
    const hasAnomalyRecord = teamRecords.some(tr => tr.isAnomaly || tr.needsConfirmation)
    const isAnomaly = team.hasAnomaly || hasResourceOverspend || hasAnomalyRecord

    const anomalyNotes = teamRecords
      .filter(tr => tr.resourceRemaining < 0 || tr.isAnomaly || tr.needsConfirmation)
      .map(tr => {
        const roundNum = rounds.find(r => r.id === tr.roundId)?.roundNumber ?? 0
        const notes: string[] = []
        if (tr.resourceRemaining < 0) notes.push(`R${roundNum}超支${tr.resourceRemaining}`)
        if (tr.needsConfirmation) notes.push(`R${roundNum}待确认`)
        return notes.join("+")
      })
      .filter(Boolean)
    const anomalySummary = anomalyNotes.length > 0 ? anomalyNotes.join("; ") : team.rawNote

    return [
      team.name,
      String(team.totalScore),
      ...roundCells,
      isAnomaly ? "是" : "否",
      anomalySummary,
      sourceMap[team.source] || team.source,
      team.rawNote,
    ]
  })

  const csvContent = [allHeaders.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n")
  return "\uFEFF" + csvContent
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export function exportTXT(data: MatchData): string {
  const { match, teams, rounds, teamRounds } = data
  const lines: string[] = []

  lines.push("===== 火箭燃料配平赛 回放报告 =====")
  lines.push(`对局：${match.name}`)
  lines.push(`日期：${new Date(match.createdAt).toLocaleString("zh-CN")}`)
  lines.push(`轮数：${match.totalRounds}  每轮时长：${match.roundDurationSec}秒`)
  lines.push(`资源上限：${match.resourceLimit}`)
  lines.push("")

  rounds.forEach((round) => {
    lines.push(`── 第 ${round.roundNumber} 轮 ──`)

    if (round.pauseReason) {
      lines.push(`  ⏸ 暂停 ${round.pausedDurationSec} 秒，原因：${round.pauseReason}`)
    }

    teams.forEach((team) => {
      const tr = teamRounds.find((t) => t.teamId === team.id && t.roundId === round.id)
      if (!tr) {
        lines.push(`  ${team.name}：未记录`)
        return
      }

      let line = `  ${team.name}：选择燃料 ${tr.fuelChoice}，消耗资源 ${tr.resourceUsed}，剩余 ${tr.resourceRemaining}，扣分 ${tr.deduction}（${tr.deductionReason}）`

      if (tr.resourceRemaining < 0) {
        line += `\n  ⚠️ 资源为负（${tr.resourceRemaining}），需确认：${tr.anomalyNote || "资源超支"}`
      }

      if (tr.needsConfirmation) {
        line += `\n  ⚠️ 需确认：${tr.confirmationNote}`
      }

      if (tr.source === "projection_screen") {
        line += `\n  📺 投影大屏补录`
      }

      if (tr.rawNote) {
        line += `\n  📝 备注：${tr.rawNote}`
      }

      if (tr.source === "projection_screen" && tr.projectionRecordedAt) {
        const projTime = new Date(tr.projectionRecordedAt).toLocaleString("zh-CN")
        const operator = tr.projectionOperator || "未知"
        line += `\n  🕒 补录时间：${projTime}（${operator}）`
      }

      lines.push(line)
    })

    lines.push("")
  })

  lines.push("── 最终排名 ──")
  const sorted = [...teams].sort((a, b) => b.totalScore - a.totalScore)
  sorted.forEach((team, idx) => {
    let line = `${idx + 1}. ${team.name} ${team.totalScore}分`
    if (team.hasAnomaly) line += " ⚠️"
    const teamRecs = teamRounds.filter((tr) => tr.teamId === team.id && tr.needsConfirmation)
    if (teamRecs.length > 0) line += " 需人工确认"
    if (team.source === "projection_screen") line += " 📺投影大屏补录"
    lines.push(line)
  })

  return lines.join("\n")
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
