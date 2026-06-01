import type { FailureDiagnosis, FailReason, GameSession, LevelConfig, ActionRecord } from '@/types'
import { FUND_ASSETS } from '@/data/funds'

export function diagnoseFailure(
  session: GameSession,
  level: LevelConfig,
  recentActions: ActionRecord[]
): FailureDiagnosis {
  const failReason = session.failReason

  if (failReason === 'rule') {
    const last3 = recentActions.slice(-3)
    let ruleViolated = '违反风险控制规则'
    let ruleExplanation = '在风险已超限的情况下仍然加仓高风险基金，加剧了投资组合的风险敞口'
    const equityActions = last3.filter(a => {
      const fund = FUND_ASSETS.find(f => f.id === a.fundId)
      return fund && fund.category === 'equity' && a.deltaRatio > 0 && a.riskBefore > level.riskLimit
    })
    if (equityActions.length > 0) {
      ruleViolated = '在风险超限时加仓股票型基金'
      ruleExplanation = `最近${equityActions.length}次操作在风险已超过限制${level.riskLimit}时仍加仓股票型基金，违反了风险控制规则`
    }
    return {
      reason: 'rule',
      ruleViolated,
      ruleExplanation,
      timeRemaining: null,
      riskExceeded: null,
      suggestion: '遵守风险控制规则，当风险超限时应减少高风险持仓而非加仓'
    }
  }

  if (failReason === 'timeout') {
    return {
      reason: 'timeout',
      ruleViolated: null,
      ruleExplanation: null,
      timeRemaining: 0,
      riskExceeded: null,
      suggestion: '合理分配时间，优先完成核心配置操作，避免在不必要的调整上消耗过多时间'
    }
  }

  if (failReason === 'risk') {
    const riskExceeded = session.currentRisk - level.riskLimit
    return {
      reason: 'risk',
      ruleViolated: null,
      ruleExplanation: null,
      timeRemaining: null,
      riskExceeded,
      suggestion: `风险超出限制${riskExceeded.toFixed(2)}，建议减少高风险（股票型、进取混合型）基金的配比，增加低风险（债券型、货币型）基金`
    }
  }

  if (failReason === 'resource') {
    return {
      reason: 'resource',
      ruleViolated: null,
      ruleExplanation: null,
      timeRemaining: null,
      riskExceeded: null,
      suggestion: '合理管理预算，优先配置性价比高的基金，避免在单一基金上投入过多资源'
    }
  }

  return {
    reason: failReason,
    ruleViolated: null,
    ruleExplanation: null,
    timeRemaining: null,
    riskExceeded: null,
    suggestion: '请检查投资组合配置并重新尝试'
  }
}
