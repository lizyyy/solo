import type { SettlementPlan, SpotRate, KpiData } from '../data/types'

export interface TrialResult {
  lockedTotalCNY: number
  spotTotalCNY: number
  savings: number
  savingsPercent: number
  perPlan: {
    planId: string
    currency: string
    amount: number
    lockedRate: number
    spotRate: number
    lockedCNY: number
    spotCNY: number
    diff: number
  }[]
}

export function runTrialCalculation(
  plans: SettlementPlan[],
  spotRates: SpotRate[]
): TrialResult {
  let lockedTotalCNY = 0
  let spotTotalCNY = 0
  const perPlan: TrialResult['perPlan'] = []

  for (const plan of plans) {
    if (plan.status === 'skipped_exception') continue

    const spotRate = spotRates.find((r) => r.currency === plan.currency)?.rate ?? plan.settledRate
    const lockedCNY = plan.amount * plan.settledRate
    const spotCNY = plan.amount * spotRate

    lockedTotalCNY += lockedCNY
    spotTotalCNY += spotCNY

    perPlan.push({
      planId: plan.id,
      currency: plan.currency,
      amount: plan.amount,
      lockedRate: plan.settledRate,
      spotRate,
      lockedCNY,
      spotCNY,
      diff: lockedCNY - spotCNY,
    })
  }

  const savings = lockedTotalCNY - spotTotalCNY
  const savingsPercent = spotTotalCNY > 0 ? (savings / spotTotalCNY) * 100 : 0

  return { lockedTotalCNY, spotTotalCNY, savings, savingsPercent, perPlan }
}

export function computeKpi(
  plans: SettlementPlan[],
  exceptions: { impactAmount: number; impactCurrency: string }[]
): KpiData {
  let totalPendingSettlement = 0
  let totalForwardLocked = 0
  let totalUncoveredGap = 0

  for (const p of plans) {
    totalPendingSettlement += p.settledAmountCNY
    if (p.forwardContractId) {
      totalForwardLocked += p.settledAmountCNY
    } else {
      totalUncoveredGap += p.settledAmountCNY
    }
  }

  return {
    totalPendingSettlement,
    totalForwardLocked,
    totalUncoveredGap,
    exceptionCount: exceptions.length,
  }
}

export function executeBatch(plans: SettlementPlan[]): SettlementPlan[] {
  return plans.map((p) => {
    if (p.status === 'skipped_exception') return p
    return { ...p, status: 'executed' as const }
  })
}

export function generateReportData(
  plans: SettlementPlan[],
  dateFrom: string,
  dateTo: string
) {
  const filtered = plans.filter((p) => {
    return p.plannedDate >= dateFrom && p.plannedDate <= dateTo
  })

  const totalSettledCNY = filtered
    .filter((p) => p.status === 'executed')
    .reduce((sum, p) => sum + p.settledAmountCNY, 0)

  const totalUncoveredCNY = filtered
    .filter((p) => !p.forwardContractId)
    .reduce((sum, p) => sum + p.settledAmountCNY, 0)

  const exceptionCount = filtered.filter((p) => p.status === 'skipped_exception').length

  return {
    id: `RPT-${Date.now()}`,
    reportDate: new Date().toISOString().slice(0, 10),
    dateFrom,
    dateTo,
    totalSettledCNY,
    totalUncoveredCNY,
    exceptionCount,
    exportFormat: 'CSV' as const,
  }
}
