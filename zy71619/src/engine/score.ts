import type { WaveCard, SamplePoint, Deduction, ScoreState } from "@/types"
import { synthesizeWave } from "./wave"

function computeNMSE(player: SamplePoint[], target: SamplePoint[]): number {
  const n = Math.min(player.length, target.length)
  if (n === 0) return 1

  let sumSqDiff = 0
  let sumSqTarget = 0
  for (let i = 0; i < n; i++) {
    const diff = player[i].y - target[i].y
    sumSqDiff += diff * diff
    sumSqTarget += target[i].y * target[i].y
  }
  if (sumSqTarget === 0) return sumSqDiff === 0 ? 0 : 1
  return sumSqDiff / sumSqTarget
}

export function computeMatchPercent(playerWave: WaveCard[], targetWave: WaveCard[], time: number = 0): number {
  const playerPoints = synthesizeWave(playerWave, time)
  const targetPoints = synthesizeWave(targetWave, time)
  const nmse = computeNMSE(playerPoints, targetPoints)
  return Math.max(0, Math.min(100, (1 - nmse) * 100))
}

export function computeScore(
  matchPercent: number,
  maxScore: number,
  deductions: Deduction[]
): number {
  const raw = (matchPercent / 100) * maxScore
  const totalDeduction = deductions.reduce((sum, d) => sum + d.points, 0)
  return Math.max(0, Math.round(raw - totalDeduction))
}

export function generateSuggestions(deductions: Deduction[], matchPercent: number): string[] {
  const suggestions: string[] = []

  if (matchPercent < 30) {
    suggestions.push("当前波形与目标差异很大，尝试先匹配低频分量的振幅和频率")
  } else if (matchPercent < 60) {
    suggestions.push("波形大致形状接近，注意调整相位让波峰对齐目标位置")
  } else if (matchPercent < 85) {
    suggestions.push("快要成功了！微调高频分量的振幅来消除细节差异")
  }

  const hasPhaseError = deductions.some((d) => d.reason.includes("相位"))
  if (hasPhaseError) {
    suggestions.push("注意相位单位：检查是否混淆了弧度和角度，1弧度≈57.3°")
  }

  const hasAmplitudeError = deductions.some((d) => d.reason.includes("振幅"))
  if (hasAmplitudeError) {
    suggestions.push("振幅叠加超出安全范围时，可尝试等比缩放各分量")
  }

  const hasBoundaryError = deductions.some((d) => d.reason.includes("边界"))
  if (hasBoundaryError) {
    suggestions.push("角色冲出边界通常意味着合成波振幅过大，适当减小分量振幅")
  }

  if (suggestions.length === 0 && matchPercent >= 85) {
    suggestions.push("做得很好！继续保持当前的调参策略")
  }

  return suggestions
}

export function createInitialScore(maxScore: number): ScoreState {
  return {
    total: 0,
    maxScore,
    matchPercent: 0,
    deductions: [],
    keyChoices: [],
    suggestions: [],
  }
}
