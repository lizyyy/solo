import { ElevationValidator } from './elevationValidator.js'
import { RelationshipValidator } from './relationshipValidator.js'
import { CoordinateValidator } from './coordinateValidator.js'

export class Validator {
  static validate(contexts, finds, rules) {
    const allIssues = []

    const elevationIssues = ElevationValidator.validate(contexts, rules)
    allIssues.push(...elevationIssues)

    const relationshipIssues = RelationshipValidator.validate(contexts, rules)
    allIssues.push(...relationshipIssues)

    const coordinateIssues = CoordinateValidator.validate(finds, contexts, rules)
    allIssues.push(...coordinateIssues)

    const sortedIssues = this.sortIssues(allIssues)

    return {
      issues: sortedIssues,
      summary: this.generateSummary(sortedIssues),
      statistics: this.generateStatistics(sortedIssues)
    }
  }

  static sortIssues(issues) {
    const severityOrder = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    }

    return [...issues].sort((a, b) => {
      const orderA = severityOrder[a.severity] || 3
      const orderB = severityOrder[b.severity] || 3
      return orderA - orderB
    })
  }

  static generateSummary(issues) {
    const critical = issues.filter(i => i.severity === 'critical').length
    const high = issues.filter(i => i.severity === 'high').length
    const medium = issues.filter(i => i.severity === 'medium').length
    const low = issues.filter(i => i.severity === 'low').length

    const errors = issues.filter(i => i.type === 'error').length
    const warnings = issues.filter(i => i.type === 'warning').length
    const info = issues.filter(i => i.type === 'info').length

    return {
      total: issues.length,
      bySeverity: { critical, high, medium, low },
      byType: { errors, warnings, info }
    }
  }

  static generateStatistics(issues) {
    const stats = {
      elevation: { total: 0, errors: 0, warnings: 0 },
      relationship: { total: 0, errors: 0, warnings: 0 },
      coordinate: { total: 0, errors: 0, warnings: 0 }
    }

    issues.forEach((issue) => {
      const category = issue.category
      if (stats[category]) {
        stats[category].total++
        if (issue.type === 'error') {
          stats[category].errors++
        } else if (issue.type === 'warning') {
          stats[category].warnings++
        }
      }
    })

    return stats
  }

  static toCSV(validationResult) {
    const issues = validationResult.issues
    const headers = ['类型', '类别', '严重程度', '地层编号', '出土物编号', '消息', '详情']
    
    const rows = [headers.join(',')]
    
    issues.forEach((issue) => {
      const row = [
        this.escapeCSV(issue.type),
        this.escapeCSV(issue.category),
        this.escapeCSV(issue.severity),
        this.escapeCSV(issue.layerId || '-'),
        this.escapeCSV(issue.findId || '-'),
        this.escapeCSV(issue.message),
        this.escapeCSV(issue.detail)
      ]
      rows.push(row.join(','))
    })

    return rows.join('\n')
  }

  static escapeCSV(value) {
    if (value === null || value === undefined) {
      return ''
    }
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
}

export { ElevationValidator, RelationshipValidator, CoordinateValidator }
export default Validator
