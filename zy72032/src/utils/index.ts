import type {
  TrainingRecord,
  StepResult,
  ExceptionItem,
  FailureType,
} from "@/types"

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${month}/${day} ${hours}:${minutes}`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function calculateTotalScore(steps: StepResult[]): {
  score: number
  maxScore: number
} {
  let score = 0
  let maxScore = 0
  steps.forEach((step) => {
    const stepMaxScore = 20
    maxScore += stepMaxScore
    if (step.isCorrect) {
      score += stepMaxScore
    }
    if (step.deduction) {
      score -= step.deduction.points
    }
    score = Math.max(0, score)
  })
  return { score, maxScore }
}

export function determineFailureDiagnosis(
  steps: StepResult[],
  totalScore: number,
  passingScore: number
): { type: FailureType; detail: string } | undefined {
  if (totalScore >= passingScore) return undefined

  const ruleErrors = steps.filter(
    (s) => s.deduction?.type === "规则未理解" || !s.isCorrect
  ).length
  const timeouts = steps.filter((s) => s.timedOut).length
  const slowSteps = steps.filter(
    (s) => !s.timedOut && s.timeTaken > s.timeLimit * 0.8
  ).length

  if (ruleErrors >= 2) {
    return {
      type: "规则未理解",
      detail: `这局你在 ${ruleErrors} 个场景里选了不符合规则的答案，建议先把客服话术规则再过一遍，重点看"退换货判定"和"情绪安抚优先级"两节。`,
    }
  }

  if (timeouts >= 1 || slowSteps >= 2) {
    return {
      type: "操作偏慢",
      detail: `有 ${timeouts + slowSteps} 步你花了太久做决定。客服场景下客户不会等你慢慢想，试着把常见选项记熟，或者先凭第一反应选，错了再复盘反而进步更快。`,
    }
  }

  if (ruleErrors === 1 && timeouts === 0) {
    return {
      type: "规则未理解",
      detail: `只错了 1 题，差一点就过了。看一下那道题的扣分原因，应该是某个规则细节没记牢，再练一局应该就能过。`,
    }
  }

  return {
    type: "规则未理解",
    detail: `整体差 ${passingScore - totalScore} 分过关。把每道错题的原因对照规则看一遍，重点搞懂"为什么"而不是"选什么"。`,
  }
}

export function extractExceptions(record: TrainingRecord): ExceptionItem[] {
  const exceptions: ExceptionItem[] = []

  if (record.needsManualReview) {
    exceptions.push({
      recordId: record.id,
      type: "需人工确认",
      description: "这局包含边界情况，需要老师确认是否通过",
      timestamp: record.endTime,
    })
  }

  record.pauses.forEach((pause, idx) => {
    exceptions.push({
      recordId: record.id,
      type: "主动暂停",
      stepIndex: pause.stepIndex,
      description: `第 ${pause.stepIndex + 1} 步被暂停，持续 ${formatTime(pause.duration / 1000)}`,
      timestamp: pause.timestamp,
    })
  })

  record.steps.forEach((step, idx) => {
    if (step.timedOut) {
      exceptions.push({
        recordId: record.id,
        type: "操作超时",
        stepIndex: idx,
        description: `第 ${idx + 1} 步超时未选择，自动扣分`,
        timestamp: record.startTime + idx * 30000,
      })
    }

    if (step.isBoundaryCase && !step.isCorrect) {
      exceptions.push({
        recordId: record.id,
        type: "边界分数",
        stepIndex: idx,
        description: `第 ${idx + 1} 步是边界场景且答错，${
          step.deduction
            ? `扣 ${step.deduction.points} 分（${step.deduction.reason}）`
            : "规则灰色地带"
        }`,
        timestamp: record.startTime + idx * 30000,
      })
    }

    if (step.deduction?.type === "规则未理解") {
      exceptions.push({
        recordId: record.id,
        type: "规则未理解",
        stepIndex: idx,
        description: `第 ${idx + 1} 步：${step.deduction.reason}`,
        timestamp: record.startTime + idx * 30000,
      })
    }
  })

  record.supplements.forEach((supp) => {
    if (supp.previousScore !== undefined && supp.newScore !== undefined) {
      exceptions.push({
        recordId: record.id,
        type: "补录调整",
        description: `${supp.source}：分数从 ${supp.previousScore} 调整为 ${supp.newScore}，${supp.content}`,
        timestamp: supp.timestamp,
      })
    }
  })

  return exceptions
}

export function calculateSummary(records: TrainingRecord[]) {
  const totalRecords = records.length
  const passedRecords = records.filter((r) => r.passed).length
  const passRate =
    totalRecords > 0 ? Math.round((passedRecords / totalRecords) * 100) : 0
  const avgDuration =
    totalRecords > 0
      ? Math.round(
          records.reduce((sum, r) => sum + (r.endTime - r.startTime), 0) /
            totalRecords /
            1000
        )
      : 0

  const allExceptions = records.flatMap((r) => extractExceptions(r))

  return {
    totalRecords,
    passedRecords,
    passRate,
    avgDuration,
    exceptionCount: allExceptions.length,
    allExceptions,
  }
}
