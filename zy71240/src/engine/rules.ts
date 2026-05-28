import type {
  RepairGrade,
  RiskLevel,
  ErrorType,
  Judgment,
  Settlement,
  ErrorImpact,
  AmendmentRecord,
  ClueItem,
} from "@/types"
import { PART_CARDS, REPAIR_PRICES, POLICY_RULES, STANDARD_ANSWERS } from "@/data/mockData"

export function getPriceForGrade(caseId: string, partName: string, grade: RepairGrade): number {
  const prices = REPAIR_PRICES[caseId] || []
  const price = prices.find((p) => p.partName === partName)
  if (!price) return 0
  switch (grade) {
    case "轻微": return price.minorPrice
    case "中度": return price.moderatePrice
    case "重度": return price.severePrice
    case "报废": return price.totalLossPrice
    default: return 0
  }
}

export function calculatePayout(caseId: string, judgments: Judgment[]): number {
  return judgments.reduce((sum, j) => sum + j.estimatedPayout, 0)
}

export function detectOldDamageError(
  caseId: string,
  selectedClues: ClueItem[],
  judgments: Judgment[]
): ErrorImpact | null {
  const parts = PART_CARDS[caseId] || []
  const selectedPartIds = selectedClues.filter((c) => c.type === "部位卡").map((c) => c.id)
  const selectedPartCards = parts.filter((p) => selectedPartIds.includes(p.id))

  const partsWithOldDamage = selectedPartCards.filter((p) => p.hasOldDamage)
  const answeredParts = judgments.map((j) => j.partName)

  const missedOldDamage = partsWithOldDamage.filter((p) =>
    answeredParts.includes(p.partName)
  )

  if (missedOldDamage.length === 0) return null

  const affectedParts = missedOldDamage.map((p) => p.partName)
  const affectedAmounts = missedOldDamage.map((p) => {
    const j = judgments.find((jg) => jg.partName === p.partName)
    return j ? `¥${j.estimatedPayout}（含旧伤）` : ""
  })

  return {
    id: `ei-old-${caseId}`,
    settlementId: "",
    errorType: "旧伤误判" as ErrorType,
    affectedParts,
    affectedAmounts,
    affectedClauses: [],
    reason: missedOldDamage
      .map((p) => `${p.partName}存在旧伤（${p.oldDamageDetail}），赔付时应扣除旧伤部分`)
      .join("；"),
    severity: "高",
  }
}

export function detectPriceLimitError(
  caseId: string,
  totalPayout: number
): ErrorImpact | null {
  const rules = POLICY_RULES[caseId] || []
  const limitRule = rules.find((r) => r.coverageLimit > 0)

  if (!limitRule) return null
  if (totalPayout <= limitRule.coverageLimit) return null

  const excess = totalPayout - limitRule.coverageLimit

  return {
    id: `ei-price-${caseId}`,
    settlementId: "",
    errorType: "价格超限" as ErrorType,
    affectedParts: [],
    affectedAmounts: [`总赔付 ¥${totalPayout} 超出限额 ¥${limitRule.coverageLimit}，超出 ¥${excess}`],
    affectedClauses: [limitRule.clauseContent],
    reason: `根据"${limitRule.clauseType}"：${limitRule.clauseContent}，实际赔付金额 ¥${totalPayout} 超过限额 ¥${limitRule.coverageLimit}`,
    severity: "中",
  }
}

export function detectExemptionError(
  caseId: string,
  selectedClues: ClueItem[]
): ErrorImpact | null {
  const rules = POLICY_RULES[caseId] || []
  const exemptionRules = rules.filter((r) => r.isExemption)
  const selectedRuleIds = selectedClues.filter((c) => c.type === "保单条款").map((c) => c.id)

  const missedExemptions = exemptionRules.filter((r) => !selectedRuleIds.includes(r.id))

  if (missedExemptions.length === 0) return null

  return {
    id: `ei-exempt-${caseId}`,
    settlementId: "",
    errorType: "免责条款漏看" as ErrorType,
    affectedParts: missedExemptions.flatMap((r) => r.relatedParts),
    affectedAmounts: [],
    affectedClauses: missedExemptions.map((r) => `${r.clauseType}：${r.clauseContent}`),
    reason: missedExemptions
      .map((r) => `未查看免责条款"${r.clauseType}"：${r.clauseContent}，该条款影响部位：${r.relatedParts.join("、") || "全案"}`)
      .join("；"),
    severity: "高",
  }
}

export function runSettlement(
  caseId: string,
  selectedClues: ClueItem[],
  judgments: Judgment[],
  riskLevel: RiskLevel
): { settlement: Settlement; errorImpacts: ErrorImpact[] } {
  const totalPayout = calculatePayout(caseId, judgments)
  const answer = STANDARD_ANSWERS[caseId]
  const correctPayout = answer?.correctPayout ?? 0

  const errorImpacts: ErrorImpact[] = []

  const oldDamageError = detectOldDamageError(caseId, selectedClues, judgments)
  if (oldDamageError) errorImpacts.push(oldDamageError)

  const priceLimitError = detectPriceLimitError(caseId, totalPayout)
  if (priceLimitError) errorImpacts.push(priceLimitError)

  const exemptionError = detectExemptionError(caseId, selectedClues)
  if (exemptionError) errorImpacts.push(exemptionError)

  const settlement: Settlement = {
    id: `settle-${caseId}-${Date.now()}`,
    sessionId: "",
    totalPayout,
    correctPayout,
    payoutDifference: totalPayout - correctPayout,
    hasOldDamageError: !!oldDamageError,
    hasPriceLimitError: !!priceLimitError,
    hasExemptionError: !!exemptionError,
    riskLevel,
  }

  return { settlement, errorImpacts }
}

export function createAmendment(
  reportId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason: string,
  amendedBy: string
): AmendmentRecord {
  return {
    id: `amend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reportId,
    fieldName,
    oldValue,
    newValue,
    reason,
    amendedAt: Date.now(),
    amendedBy,
  }
}

export function applyAmendmentValue(
  currentValue: string,
  amendments: AmendmentRecord[],
  fieldName: string
): { displayValue: string; hasAmendment: boolean; latestAmendment: AmendmentRecord | null } {
  const fieldAmendments = amendments.filter((a) => a.fieldName === fieldName)
  if (fieldAmendments.length === 0) {
    return { displayValue: currentValue, hasAmendment: false, latestAmendment: null }
  }
  const latest = fieldAmendments[fieldAmendments.length - 1]
  return { displayValue: latest.newValue, hasAmendment: true, latestAmendment: latest }
}
