import type { Suspect, Clue, BayesCalculation, InferenceStep } from '../types'
import { generateExplanation } from './explanationGenerator'

export function calculatePosterior(
  suspects: Suspect[],
  clue: Clue,
  drawnClueIds: string[],
  stepNumber: number,
  arrivalOrder: number
): {
  updatedSuspects: Suspect[]
  inferenceStep: InferenceStep
} {
  const priorProbabilities: Record<string, number> = {}
  suspects.forEach((s) => {
    priorProbabilities[s.id] = s.currentProbability
  })

  const isDuplicate = checkDuplicateEvidence(clue, drawnClueIds)
  const isReversed = checkReversedConditional(clue, suspects)

  const denominator = suspects.reduce((sum, s) => {
    const likelihood = clue.likelihoods[s.id] ?? 0.5
    return sum + likelihood * s.currentProbability
  }, 0)

  const calculations: BayesCalculation[] = suspects.map((s) => {
    const likelihood = clue.likelihoods[s.id] ?? 0.5
    const numerator = likelihood * s.currentProbability
    const rawPosterior = denominator > 0 ? numerator / denominator : s.currentProbability

    let posterior = rawPosterior
    let isPriorSupplement = false
    let priorSupplementNote: string | undefined

    if (isDuplicate) {
      posterior = applyDuplicateAdjustment(s, clue, rawPosterior, drawnClueIds)
    }

    if (isReversed && clue.type === 'exonerating') {
      const reversedResult = applyReversedConditional(s, clue, rawPosterior)
      posterior = reversedResult.posterior
      isPriorSupplement = reversedResult.isPriorSupplement
      priorSupplementNote = reversedResult.note
    }

    const consistencyConflict = checkConsistencyConflict(s, clue)
    if (consistencyConflict.hasConflict) {
      const adjusted = applyConsistencyAdjustment(s, clue, posterior, priorProbabilities[s.id])
      posterior = adjusted.posterior
      if (adjusted.note) {
        isPriorSupplement = true
        priorSupplementNote = adjusted.note
      }
    }

    return {
      suspectId: s.id,
      suspectName: s.name,
      prior: s.currentProbability,
      likelihood,
      numerator,
      denominator,
      posterior: Math.max(0.01, Math.min(0.99, posterior)),
      formula: `P(${s.name}|${clue.title}) = ${likelihood.toFixed(3)} × ${s.currentProbability.toFixed(3)} / ${denominator.toFixed(3)} = ${posterior.toFixed(3)}`,
      isPriorSupplement,
      priorSupplementNote,
    }
  })

  if (!isDuplicate) {
    const totalPosterior = calculations.reduce((sum, c) => sum + c.posterior, 0)
    if (totalPosterior > 0) {
      calculations.forEach((c) => {
        c.posterior = c.posterior / totalPosterior
      })
    }
  }

  const updatedSuspects = suspects.map((s, i) => ({
    ...s,
    currentProbability: Math.round(calculations[i].posterior * 1000) / 1000,
  }))

  const posteriorProbabilities: Record<string, number> = {}
  updatedSuspects.forEach((s) => {
    posteriorProbabilities[s.id] = s.currentProbability
  })

  const inferenceStep: InferenceStep = {
    stepNumber,
    clue,
    timestamp: Date.now(),
    priorProbabilities,
    posteriorProbabilities,
    calculationDetails: calculations,
    explanation: generateExplanation(clue, calculations, isDuplicate, isReversed),
    isDuplicateEvidence: isDuplicate,
    duplicateNote: isDuplicate
      ? `线索「${clue.title}」与已翻出的证据存在关联，概率不归一处理，按翻牌顺序累积记录`
      : undefined,
    arrivalOrder,
    isReversedConditional: isReversed,
    reversedConditionalNote: isReversed
      ? `线索「${clue.title}」采用条件概率反用策略——因为证据与洗清嫌疑的方向一致，先验概率作为补充证据保留在计算明细中`
      : undefined,
  }

  return { updatedSuspects, inferenceStep }
}

function checkDuplicateEvidence(clue: Clue, drawnClueIds: string[]): boolean {
  return clue.relatedClueIds.some((id) => drawnClueIds.includes(id))
}

function checkReversedConditional(clue: Clue, suspects: Suspect[]): boolean {
  if (clue.type !== 'exonerating') return false
  const minLikelihood = Math.min(...suspects.map((s) => clue.likelihoods[s.id] ?? 0.5))
  return minLikelihood < 0.1
}

function applyDuplicateAdjustment(
  suspect: Suspect,
  _clue: Clue,
  rawPosterior: number,
  _drawnClueIds: string[]
): number {
  const dampingFactor = 0.7
  return suspect.currentProbability + (rawPosterior - suspect.currentProbability) * dampingFactor
}

function applyReversedConditional(
  suspect: Suspect,
  clue: Clue,
  rawPosterior: number
): { posterior: number; isPriorSupplement: boolean; note: string } {
  const prior = suspect.currentProbability
  const posterior = prior * 0.4 + rawPosterior * 0.6
  return {
    posterior,
    isPriorSupplement: true,
    note: `条件概率反用：线索「${clue.title}」对${suspect.name}的似然度极低，先验概率 ${fmt(prior)} 作为补充证据参与计算（权重40%），防止概率过度归零`,
  }
}

function checkConsistencyConflict(
  suspect: Suspect,
  clue: Clue
): { hasConflict: boolean; conflictDetail?: string } {
  const likelihood = clue.likelihoods[suspect.id] ?? 0.5
  const isGuiltyLikely = likelihood > 0.5
  const priorHigh = suspect.currentProbability > 0.3

  if (clue.type === 'incriminating' && isGuiltyLikely && !priorHigh) {
    return {
      hasConflict: true,
      conflictDetail: `线索指向${suspect.name}有罪，但其先验概率仅 ${fmt(suspect.currentProbability)}，结论与先验不一致`,
    }
  }
  if (clue.type === 'exonerating' && !isGuiltyLikely && priorHigh) {
    return {
      hasConflict: true,
      conflictDetail: `线索洗清${suspect.name}的嫌疑，但其先验概率高达 ${fmt(suspect.currentProbability)}，结论与先验不一致`,
    }
  }
  return { hasConflict: false }
}

function applyConsistencyAdjustment(
  suspect: Suspect,
  clue: Clue,
  posterior: number,
  prior: number
): { posterior: number; note?: string } {
  const blended = prior * 0.25 + posterior * 0.75
  return {
    posterior: blended,
    note: `线索「${clue.title}」给出的结论与${suspect.name}的先验概率不一致，先验 ${fmt(prior)} 作为补充证据保留（权重25%），防止更新过度偏离`,
  }
}

function fmt(n: number): string {
  return (n * 100).toFixed(1) + '%'
}
