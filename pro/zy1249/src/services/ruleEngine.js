const { getValidator, defaultRules } = require('../validators')
const { Rule } = require('../models')

class RuleEngine {
  constructor() {
    this.cacheEnabled = true
    this.ruleCache = new Map()
  }

  async init() {
    const dbRules = await Rule.findAll({ where: { isEnabled: true } })
    
    if (dbRules.length === 0) {
      for (const rule of defaultRules) {
        await Rule.findOrCreate({
          where: { ruleId: rule.ruleId },
          defaults: rule
        })
      }
    }
  }

  async getEnabledRules(rulesConfig = null) {
    let rules

    if (rulesConfig && rulesConfig.ruleOverrides) {
      rules = this.applyOverrides(defaultRules, rulesConfig.ruleOverrides)
    } else {
      const dbRules = await Rule.findAll({ where: { isEnabled: true } })
      rules = dbRules.length > 0 ? dbRules : defaultRules
    }

    return rules.filter(rule => rule.isEnabled !== false)
  }

  applyOverrides(rules, overrides) {
    return rules.map(rule => {
      const ruleData = rule.toJSON ? rule.toJSON() : { ...rule }
      
      if (overrides[ruleData.ruleId]) {
        const override = overrides[ruleData.ruleId]
        return {
          ...ruleData,
          ...override,
          config: { ...ruleData.config, ...(override.config || {}) }
        }
      }
      
      return ruleData
    })
  }

  async validate(spec, options = {}) {
    const { rulesConfig, enabledRules, context = {} } = options
    
    const allRules = await this.getEnabledRules(rulesConfig)
    
    let rulesToValidate = allRules
    if (enabledRules && enabledRules.length > 0) {
      rulesToValidate = allRules.filter(rule => 
        enabledRules.includes(rule.ruleId || rule.rule_id)
      )
    }

    const allIssues = []
    const validationResults = []

    for (const rule of rulesToValidate) {
      const ruleId = rule.ruleId || rule.rule_id
      const validator = getValidator(ruleId, rule)
      
      if (!validator) {
        continue
      }

      try {
        const issues = await validator.validate(spec, context)
        
        if (issues.length > 0) {
          allIssues.push(...issues.map(issue => ({
            ...issue,
            ruleId: issue.ruleId || ruleId,
            ruleName: issue.ruleName || rule.name
          })))
        }

        validationResults.push({
          ruleId: ruleId,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          issuesCount: issues.length,
          issues: issues.slice(0, 50)
        })
      } catch (error) {
        console.error(`Validation error for rule ${ruleId}:`, error)
        validationResults.push({
          ruleId: ruleId,
          ruleName: rule.name,
          category: rule.category,
          severity: 'error',
          error: error.message,
          issuesCount: 0,
          issues: []
        })
      }
    }

    const stats = this.calculateStats(allIssues)

    return {
      totalIssues: allIssues.length,
      issues: allIssues,
      stats: stats,
      validationResults: validationResults,
      score: this.calculateScore(allIssues, rulesToValidate)
    }
  }

  calculateStats(issues) {
    const stats = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      byCategory: {},
      byRule: {}
    }

    for (const issue of issues) {
      const severity = issue.severity || 'warning'
      stats[severity] = (stats[severity] || 0) + 1

      const category = issue.category || 'general'
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

      const ruleId = issue.ruleId || 'unknown'
      stats.byRule[ruleId] = (stats.byRule[ruleId] || 0) + 1
    }

    return stats
  }

  calculateScore(issues, rules) {
    if (rules.length === 0) {
      return 100
    }

    const severityWeight = {
      critical: 10,
      error: 5,
      warning: 2,
      info: 1
    }

    let totalWeight = 0
    let deductionWeight = 0

    for (const rule of rules) {
      const severity = rule.severity || 'warning'
      totalWeight += severityWeight[severity] || 2
    }

    for (const issue of issues) {
      const severity = issue.severity || 'warning'
      deductionWeight += severityWeight[severity] || 2
    }

    if (totalWeight === 0) {
      return 100
    }

    const score = Math.max(0, Math.min(100, Math.round(100 - (deductionWeight / totalWeight) * 100)))

    return score
  }

  groupIssues(issues, groupBy = 'severity') {
    const groups = {}

    for (const issue of issues) {
      let key
      switch (groupBy) {
        case 'severity':
          key = issue.severity || 'warning'
          break
        case 'category':
          key = issue.category || 'general'
          break
        case 'rule':
          key = issue.ruleId || 'unknown'
          break
        case 'path':
          key = issue.path || 'unknown'
          break
        case 'method':
          key = issue.method || 'unknown'
          break
        default:
          key = 'other'
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(issue)
    }

    return groups
  }

  sortIssues(issues, sortBy = 'severity') {
    const severityOrder = {
      critical: 0,
      error: 1,
      warning: 2,
      info: 3
    }

    return [...issues].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const aOrder = severityOrder[a.severity] || 4
          const bOrder = severityOrder[b.severity] || 4
          return aOrder - bOrder
        case 'path':
          return (a.path || '').localeCompare(b.path || '')
        case 'method':
          return (a.method || '').localeCompare(b.method || '')
        case 'rule':
          return (a.ruleId || '').localeCompare(b.ruleId || '')
        default:
          return 0
      }
    })
  }
}

const ruleEngine = new RuleEngine()

module.exports = {
  RuleEngine,
  ruleEngine
}