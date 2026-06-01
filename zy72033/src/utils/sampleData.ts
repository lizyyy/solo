import type { MatchData, Match, Team, Round, TeamRound } from "@/types"

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function createSmoothMatch(): MatchData {
  const matchId = uid()
  const match: Match = {
    id: matchId,
    name: "顺利配平赛·示范",
    teamCount: 3,
    totalRounds: 3,
    roundDurationSec: 90,
    resourceLimit: 100,
    status: "locked",
    pauseReason: "",
    pausedDurationSec: 0,
    createdAt: "2026-05-28T09:00:00",
  }

  const teams: Team[] = [
    { id: uid(), matchId, name: "A组", totalScore: 100, hasAnomaly: false, source: "normal", rawNote: "" },
    { id: uid(), matchId, name: "B组", totalScore: 90, hasAnomaly: false, source: "normal", rawNote: "" },
    { id: uid(), matchId, name: "C组", totalScore: 95, hasAnomaly: false, source: "normal", rawNote: "" },
  ]

  const rounds: Round[] = Array.from({ length: 3 }, (_, i) => ({
    id: uid(),
    matchId,
    roundNumber: i + 1,
    durationSec: 90,
    status: "completed" as const,
    pauseReason: "",
    pausedDurationSec: 0,
  }))

  const optimalChoice = 50

  const teamRounds: TeamRound[] = []
  const fuelChoices = [
    [48, 55, 45],
    [50, 42, 53],
    [49, 50, 47],
  ]

  teams.forEach((team, tIdx) => {
    let resourceRemaining = 100
    fuelChoices.forEach((choices, rIdx) => {
      const choice = choices[tIdx]
      const used = Math.round(choice * 0.8)
      resourceRemaining = Math.max(0, resourceRemaining - used)
      const delta = Math.abs(choice - optimalChoice) / optimalChoice * 100
      let deduction = 0
      let deductionReason = "选择合理，无扣分"

      if (delta > 30) {
        deduction = -10
        deductionReason = `燃料配比严重偏离，偏离最优值 ${delta.toFixed(0)}%`
      } else if (delta > 10) {
        deduction = -5
        deductionReason = `燃料配比偏差中等，偏离最优值 ${delta.toFixed(0)}%`
      }

      teamRounds.push({
        id: uid(),
        roundId: rounds[rIdx].id,
        teamId: team.id,
        fuelChoice: choice,
        resourceUsed: used,
        resourceRemaining,
        deduction,
        deductionReason,
        isAnomaly: false,
        anomalyNote: "",
        needsConfirmation: false,
        confirmationNote: "",
        source: "normal",
        rawNote: "",
      })
    })
  })

  return { match, teams, rounds, teamRounds }
}

function createNeedsConfirmationMatch(): MatchData {
  const matchId = uid()
  const match: Match = {
    id: matchId,
    name: "需人工确认·示范",
    teamCount: 3,
    totalRounds: 3,
    roundDurationSec: 90,
    resourceLimit: 100,
    status: "settled",
    pauseReason: "",
    pausedDurationSec: 0,
    createdAt: "2026-05-28T10:30:00",
  }

  const teams: Team[] = [
    { id: uid(), matchId, name: "A组", totalScore: 85, hasAnomaly: false, source: "normal", rawNote: "" },
    { id: uid(), matchId, name: "B组", totalScore: 60, hasAnomaly: true, source: "normal", rawNote: "新手误操作导致资源超支" },
    { id: uid(), matchId, name: "C组", totalScore: 90, hasAnomaly: true, source: "normal", rawNote: "扣分恰好在阈值边界" },
  ]

  const rounds: Round[] = [
    { id: uid(), matchId, roundNumber: 1, durationSec: 90, status: "completed", pauseReason: "", pausedDurationSec: 0 },
    { id: uid(), matchId, roundNumber: 2, durationSec: 90, status: "completed", pauseReason: "学生提问", pausedDurationSec: 45 },
    { id: uid(), matchId, roundNumber: 3, durationSec: 90, status: "completed", pauseReason: "", pausedDurationSec: 0 },
  ]

  const teamRounds: TeamRound[] = []
  const optimalChoice = 50

  const aChoices = [48, 50, 49]
  const bChoices = [55, 85, 30]
  const cChoices = [45, 55, 55]

  const allChoices = [aChoices, bChoices, cChoices]

  teams.forEach((team, tIdx) => {
    let resourceRemaining = 100
    allChoices[tIdx].forEach((choice, rIdx) => {
      const used = Math.round(choice * 0.8)
      resourceRemaining = resourceRemaining - used
      const delta = Math.abs(choice - optimalChoice) / optimalChoice * 100
      let deduction = 0
      let deductionReason = "选择合理，无扣分"
      let isAnomaly = false
      let anomalyNote = ""
      let needsConfirmation = false
      let confirmationNote = ""

      if (resourceRemaining < 0) {
        deduction = -15
        deductionReason = `资源超支，已降至 ${resourceRemaining}，需确认处理`
        isAnomaly = true
        anomalyNote = "资源为负，新手误操作"
        needsConfirmation = true
        confirmationNote = "待教师确认处理方式"
      } else if (delta > 30) {
        deduction = -10
        deductionReason = `燃料配比严重偏离，偏离最优值 ${delta.toFixed(0)}%`
      } else if (delta > 10) {
        deduction = -5
        deductionReason = `燃料配比偏差中等，偏离最优值 ${delta.toFixed(0)}%`
      }

      if (resourceRemaining === 0) {
        needsConfirmation = true
        confirmationNote = "资源恰好耗尽，边界情况"
      }

      const nearThreshold = Math.abs(delta - 10) < 0.5 || Math.abs(delta - 30) < 0.5
      if (nearThreshold && !needsConfirmation) {
        needsConfirmation = true
        confirmationNote = `扣分恰好在阈值边界（偏离${delta.toFixed(1)}%），建议确认`
      }

      teamRounds.push({
        id: uid(),
        roundId: rounds[rIdx].id,
        teamId: team.id,
        fuelChoice: choice,
        resourceUsed: used,
        resourceRemaining,
        deduction,
        deductionReason,
        isAnomaly,
        anomalyNote,
        needsConfirmation,
        confirmationNote,
        source: "normal",
        rawNote: tIdx === 1 && rIdx === 1 ? "投影大屏记：B组填多了" : "",
      })
    })
  })

  return { match, teams, rounds, teamRounds }
}

function createOldProjectionMatch(): MatchData {
  const matchId = uid()
  const match: Match = {
    id: matchId,
    name: "投影大屏补录·旧口径",
    teamCount: 2,
    totalRounds: 2,
    roundDurationSec: 60,
    resourceLimit: 80,
    status: "locked",
    pauseReason: "",
    pausedDurationSec: 0,
    createdAt: "2026-05-20T14:00:00",
  }

  const teams: Team[] = [
    { id: uid(), matchId, name: "红队", totalScore: 75, hasAnomaly: false, source: "projection_screen", rawNote: "投影大屏备注：红队第2轮好像多用了？不太确定-老张" },
    { id: uid(), matchId, name: "蓝队", totalScore: 80, hasAnomaly: false, source: "projection_screen", rawNote: "投影大屏备注：蓝队说他们选了40但写成了45？？再确认" },
  ]

  const rounds: Round[] = [
    { id: uid(), matchId, roundNumber: 1, durationSec: 60, status: "completed", pauseReason: "", pausedDurationSec: 0 },
    { id: uid(), matchId, roundNumber: 2, durationSec: 60, status: "completed", pauseReason: "投影仪闪了一下", pausedDurationSec: 30 },
  ]

  const teamRounds: TeamRound[] = []
  const optimalChoice = 40

  const redChoices = [38, 44]
  const blueChoices = [40, 42]
  const allChoices = [redChoices, blueChoices]

  teams.forEach((team, tIdx) => {
    let resourceRemaining = 80
    allChoices[tIdx].forEach((choice, rIdx) => {
      const used = Math.round(choice * 0.8)
      resourceRemaining = resourceRemaining - used
      const delta = Math.abs(choice - optimalChoice) / optimalChoice * 100
      let deduction = 0
      let deductionReason = "选择合理，无扣分"

      if (delta > 30) {
        deduction = -10
        deductionReason = `燃料配比严重偏离，偏离最优值 ${delta.toFixed(0)}%`
      } else if (delta > 10) {
        deduction = -5
        deductionReason = `燃料配比偏差中等，偏离最优值 ${delta.toFixed(0)}%`
      }

      teamRounds.push({
        id: uid(),
        roundId: rounds[rIdx].id,
        teamId: team.id,
        fuelChoice: choice,
        resourceUsed: used,
        resourceRemaining,
        deduction,
        deductionReason,
        isAnomaly: false,
        anomalyNote: "",
        needsConfirmation: false,
        confirmationNote: "",
        source: "projection_screen",
        rawNote: tIdx === 0 && rIdx === 1 ? "投影大屏备注：红队第2轮好像多用了？不太确定-老张" : tIdx === 1 && rIdx === 1 ? "投影大屏备注：蓝队说他们选了40但写成了45？？再确认" : "",
      })
    })
  })

  return { match, teams, rounds, teamRounds }
}

export function generateSampleData(): MatchData[] {
  return [createSmoothMatch(), createNeedsConfirmationMatch(), createOldProjectionMatch()]
}
