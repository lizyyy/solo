const OPTIMAL_CHOICE = 50

export function calculateDeduction(
  fuelChoice: number,
  resourceRemaining: number,
  timedOut: boolean,
  optimalChoice: number = OPTIMAL_CHOICE
): {
  deduction: number
  deductionReason: string
  isAnomaly: boolean
  anomalyNote: string
  needsConfirmation: boolean
  confirmationNote: string
} {
  if (timedOut) {
    return {
      deduction: -8,
      deductionReason: "本轮超时未提交选择",
      isAnomaly: false,
      anomalyNote: "",
      needsConfirmation: false,
      confirmationNote: "",
    }
  }

  if (resourceRemaining < 0) {
    return {
      deduction: -15,
      deductionReason: `资源超支，已降至 ${resourceRemaining}，需确认处理`,
      isAnomaly: true,
      anomalyNote: "资源为负",
      needsConfirmation: true,
      confirmationNote: "资源超支，需教师确认处理方式",
    }
  }

  const delta = Math.abs(fuelChoice - optimalChoice) / optimalChoice * 100

  let deduction = 0
  let deductionReason = "选择合理，无扣分"
  let needsConfirmation = false
  let confirmationNote = ""

  if (delta > 30) {
    deduction = -10
    deductionReason = `燃料配比严重偏离，偏离最优值 ${delta.toFixed(0)}%`
  } else if (delta > 10) {
    deduction = -5
    deductionReason = `燃料配比偏差中等，偏离最优值 ${delta.toFixed(0)}%`
  }

  if (resourceRemaining === 0) {
    needsConfirmation = true
    confirmationNote = "资源恰好耗尽，边界情况，建议确认"
  }

  const nearThreshold = Math.abs(delta - 10) < 0.5 || Math.abs(delta - 30) < 0.5
  if (nearThreshold && !needsConfirmation) {
    needsConfirmation = true
    confirmationNote = `扣分恰好在阈值边界（偏离${delta.toFixed(1)}%），建议确认`
  }

  return {
    deduction,
    deductionReason,
    isAnomaly: false,
    anomalyNote: "",
    needsConfirmation,
    confirmationNote,
  }
}

export { OPTIMAL_CHOICE }
