import { ApiLog, CostRule, ValidationIssue } from '../types'

export class CostRuleEngine {
  private rules: CostRule[] = []

  loadRules(rules: CostRule[]): void {
    this.rules = rules
  }

  findRuleForLog(log: ApiLog): CostRule | null {
    const logTime = new Date(log.timestamp).getTime()
    
    const candidateRules = this.rules.filter(r => {
      if (r.apiName !== log.apiName) return false
      
      const effectiveFrom = new Date(r.effectiveFrom).getTime()
      if (logTime < effectiveFrom) return false
      
      if (r.effectiveTo) {
        const effectiveTo = new Date(r.effectiveTo).getTime()
        if (logTime > effectiveTo) return false
      }
      
      return true
    })

    if (candidateRules.length === 0) return null

    candidateRules.sort((a, b) => b.version - a.version)
    return candidateRules[0]
  }

  calculateLogCost(log: ApiLog, rule: CostRule): number {
    const model = rule.costModel

    switch (model.type) {
      case 'perCall':
        return model.costPerCall

      case 'perDuration': {
        const durationInSeconds = log.duration / 1000
        let cost = durationInSeconds * model.costPerSecond
        if (model.minCost !== undefined && cost < model.minCost) {
          cost = model.minCost
        }
        return Math.round(cost * 10000) / 10000
      }

      case 'flatRate':
        return model.costPerCall

      case 'sharedPool':
        return 0

      default:
        return 0
    }
  }

  validateRulesAgainstLogs(logs: ApiLog[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const unknownApiNames = new Map<string, number>()
    const ruleVersionsUsed = new Map<string, number[]>()

    for (const log of logs) {
      const rule = this.findRuleForLog(log)
      if (!rule) {
        unknownApiNames.set(log.apiName, (unknownApiNames.get(log.apiName) || 0) + 1)
      } else {
        const versions = ruleVersionsUsed.get(log.apiName) || []
        if (!versions.includes(rule.version)) {
          versions.push(rule.version)
          ruleVersionsUsed.set(log.apiName, versions)
        }
      }
    }

    if (unknownApiNames.size > 0) {
      for (const [apiName, count] of unknownApiNames.entries()) {
        issues.push({
          type: 'unknown_api',
          severity: 'error',
          message: `接口 "${apiName}" 没有匹配的成本规则，影响 ${count} 条调用`,
          affectedCount: count,
          details: { apiName, callCount: count }
        })
      }
    }

    return issues
  }

  getApiRuleVersions(): Map<string, number[]> {
    const apiVersions = new Map<string, number[]>()
    for (const rule of this.rules) {
      const versions = apiVersions.get(rule.apiName) || []
      if (!versions.includes(rule.version)) {
        versions.push(rule.version)
        apiVersions.set(rule.apiName, versions)
      }
    }
    return apiVersions
  }
}
