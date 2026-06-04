import type { FundAsset, FundHolding, PortfolioCalcResult, LevelConfig, GameSession } from '@/types'

export function calculatePortfolio(holdings: FundHolding[], funds: FundAsset[]): PortfolioCalcResult {
  const fundMap = new Map(funds.map(f => [f.id, f]))

  let rawScore = 0
  let rawRisk = 0
  let totalCost = 0
  const categories = new Set<string>()

  for (const holding of holdings) {
    const fund = fundMap.get(holding.fundId)
    if (!fund) continue
    rawScore += holding.ratio * fund.scoreFactor
    rawRisk += holding.ratio * fund.riskFactor
    totalCost += holding.ratio * fund.costPerUnit
    categories.add(fund.category)
  }

  const diversificationBonus = Math.min(1 + 0.05 * categories.size, 1.2)

  const categoryArr = Array.from(categories)
  let categoryPairCount = 0
  for (let i = 0; i < categoryArr.length; i++) {
    for (let j = i + 1; j < categoryArr.length; j++) {
      categoryPairCount++
    }
  }
  const hedgeReduction = 0.03 * categoryPairCount

  const score = rawScore * diversificationBonus
  const risk = Math.max(rawRisk - hedgeReduction, 0)

  return { score, risk, diversificationBonus, hedgeReduction, totalCost }
}

export function canAddFund(
  session: GameSession,
  level: LevelConfig,
  fundId: string,
  deltaRatio: number,
  funds: FundAsset[]
): { allowed: boolean; reason?: string } {
  const fund = funds.find(f => f.id === fundId)
  if (!fund) return { allowed: false, reason: '基金不存在' }

  const cost = deltaRatio * fund.costPerUnit
  if (session.remainingResources < cost) {
    return { allowed: false, reason: '资源不足' }
  }

  const currentTotalRatio = session.holdings.reduce((sum, h) => sum + h.ratio, 0)
  if (currentTotalRatio + deltaRatio > 1.0) {
    return { allowed: false, reason: '总配比不能超过100%' }
  }

  if (session.currentRisk > level.riskLimit && fund.category === 'equity' && deltaRatio > 0) {
    return { allowed: false, reason: '规则违反：风险已超限，不能加仓股票型基金' }
  }

  return { allowed: true }
}

export function checkGameEnd(
  session: GameSession,
  level: LevelConfig
): { ended: boolean; result: 'completed' | 'failed'; failReason?: string; failDetail?: string } {
  if (session.currentRisk > level.riskLimit) {
    return {
      ended: true,
      result: 'failed',
      failReason: 'risk',
      failDetail: `当前风险${session.currentRisk.toFixed(2)}超过限制${level.riskLimit}`
    }
  }

  if (session.remainingTime <= 0) {
    return {
      ended: true,
      result: 'failed',
      failReason: 'timeout',
      failDetail: '时间耗尽'
    }
  }

  if (session.remainingResources <= 0 && session.holdings.length === 0) {
    return {
      ended: true,
      result: 'failed',
      failReason: 'resource',
      failDetail: '资源耗尽且无持仓'
    }
  }

  if (session.currentScore >= level.targetScore && session.currentRisk <= level.riskLimit) {
    return { ended: true, result: 'completed' }
  }

  return { ended: false, result: 'completed' }
}
