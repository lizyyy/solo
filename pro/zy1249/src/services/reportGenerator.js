const { Review, Issue } = require('../models')

class ReportGenerator {
  async generateReport(reviewId, options = {}) {
    const { format = 'json', includeCodeExamples = true, includeSuggestions = true } = options

    const review = await Review.findByPk(reviewId, {
      include: [{
        model: Issue,
        as: 'issues',
        order: [['severity', 'ASC']]
      }]
    })

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    const issues = review.issues || []
    const groupedIssues = this.groupIssuesBySeverity(issues)
    const issuesByRule = this.groupIssuesByRule(issues)
    const issuesByPath = this.groupIssuesByPath(issues)

    const reportData = {
      metadata: {
        reviewId: review.id,
        apiName: review.apiName,
        apiVersion: review.apiVersion,
        score: review.score,
        status: review.status,
        generatedAt: new Date().toISOString(),
        statistics: {
          total: review.totalIssues,
          critical: review.criticalIssues,
          error: review.errorIssues,
          warning: review.warningIssues,
          info: review.infoIssues
        }
      },
      summary: this.generateSummary(review, groupedIssues),
      issues: {
        bySeverity: groupedIssues,
        byRule: issuesByRule,
        byPath: issuesByPath
      },
      recommendations: this.generateRecommendations(issues)
    }

    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        return this.generateMarkdownReport(reportData, { includeCodeExamples, includeSuggestions })
      case 'json':
      default:
        return this.generateJsonReport(reportData)
    }
  }

  generateJsonReport(reportData) {
    return {
      format: 'json',
      ...reportData
    }
  }

  generateMarkdownReport(reportData, options = {}) {
    const { includeCodeExamples = true, includeSuggestions = true } = options
    const { metadata, summary, issues, recommendations } = reportData

    let markdown = `# API 设计规范评审报告\n\n`
    
    markdown += this.generateMetadataSection(metadata)
    markdown += this.generateSummarySection(summary, metadata)
    markdown += this.generateIssuesSection(issues, { includeCodeExamples, includeSuggestions })
    markdown += this.generateRecommendationsSection(recommendations)
    markdown += this.generateAppendix()

    return markdown
  }

  generateMetadataSection(metadata) {
    const scoreColor = this.getScoreColor(metadata.score)
    
    return `## 概览\n\n| 项目 | 内容 |\n|------|------|\n| API 名称 | ${metadata.apiName || '未命名'} |\n| API 版本 | ${metadata.apiVersion || '未知'} |\n| 评审 ID | ${metadata.reviewId} |\n| 评审状态 | ${this.getStatusEmoji(metadata.status)} ${this.getStatusText(metadata.status)} |\n| 生成时间 | ${metadata.generatedAt} |\n\n`
  }

  generateSummarySection(summary, metadata) {
    const { score, statistics } = metadata
    
    let markdown = `## 评分概览\n\n`
    
    markdown += `### 合规性得分\n\n`
    markdown += `**${score}/100** - ${this.getScoreDescription(score)}\n\n`
    
    markdown += `### 问题统计\n\n`
    markdown += `| 严重级别 | 数量 |\n|----------|------|\n`
    markdown += `| 🔴 Critical (严重) | ${statistics.critical} |\n`
    markdown += `| 🟠 Error (错误) | ${statistics.error} |\n`
    markdown += `| 🟡 Warning (警告) | ${statistics.warning} |\n`
    markdown += `| 🔵 Info (信息) | ${statistics.info} |\n`
    markdown += `| **总计** | **${statistics.total}** |\n\n`

    markdown += `### 评分说明\n\n`
    markdown += `- **Critical**: 严重问题，必须立即修复\n`
    markdown += `- **Error**: 错误问题，建议尽快修复\n`
    markdown += `- **Warning**: 警告问题，建议修复\n`
    markdown += `- **Info**: 信息提示，可选择性修复\n\n`

    return markdown
  }

  generateIssuesSection(issues, options) {
    const { includeCodeExamples, includeSuggestions } = options
    const { bySeverity, byRule, byPath } = issues

    let markdown = `## 问题详情\n\n`

    const severityOrder = ['critical', 'error', 'warning', 'info']
    const severityLabels = {
      critical: '🔴 Critical (严重)',
      error: '🟠 Error (错误)',
      warning: '🟡 Warning (警告)',
      info: '🔵 Info (信息)'
    }

    for (const severity of severityOrder) {
      const issuesList = bySeverity[severity] || []
      if (issuesList.length === 0) continue

      markdown += `### ${severityLabels[severity]}\n\n`

      for (let i = 0; i < issuesList.length; i++) {
        const issue = issuesList[i]
        markdown += `#### ${i + 1}. ${issue.title}\n\n`
        
        markdown += `| 字段 | 值 |\n|------|-----|\n`
        if (issue.path) markdown += `| 路径 | \`${issue.path}\` |\n`
        if (issue.method) markdown += `| 方法 | ${issue.method} |\n`
        markdown += `| 规则 | ${issue.ruleName} (${issue.ruleId}) |\n`
        markdown += `| 分类 | ${issue.category} |\n\n`

        if (issue.description) {
          markdown += `**问题描述：**\n\n${issue.description}\n\n`
        }

        if (includeSuggestions && issue.suggestion) {
          markdown += `**修复建议：**\n\n${issue.suggestion}\n\n`
        }

        if (includeCodeExamples && issue.codeExample) {
          if (issue.codeExample.bad) {
            markdown += `**❌ 坏样例：**\n\n\`\`\`${issue.codeExample.bad.includes('HTTP') ? 'http' : 'yaml'}\n${issue.codeExample.bad}\n\`\`\`\n\n`
          }
          if (issue.codeExample.good) {
            markdown += `**✅ 好样例：**\n\n\`\`\`${issue.codeExample.good.includes('HTTP') ? 'http' : 'yaml'}\n${issue.codeExample.good}\n\`\`\`\n\n`
          }
        }

        if (issue.reference) {
          markdown += `**参考文档：** ${issue.reference}\n\n`
        }

        markdown += `---\n\n`
      }
    }

    return markdown
  }

  generateRecommendationsSection(recommendations) {
    let markdown = `## 修复建议\n\n`

    if (recommendations.length === 0) {
      markdown += `所有检查项通过，没有需要修复的问题。\n\n`
      return markdown
    }

    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i]
      markdown += `### ${i + 1}. ${rec.title}\n\n`
      markdown += `- **影响的问题数**: ${rec.count}\n`
      markdown += `- **严重级别**: ${rec.maxSeverity}\n\n`
      
      if (rec.suggestion) {
        markdown += `${rec.suggestion}\n\n`
      }

      if (rec.affectedPaths && rec.affectedPaths.length > 0) {
        markdown += `**受影响的路径：**\n\n`
        for (const path of rec.affectedPaths) {
          markdown += `- \`${path}\`\n`
        }
        markdown += `\n`
      }
    }

    return markdown
  }

  generateAppendix() {
    let markdown = `## 附录\n\n`
    
    markdown += `### 严重级别定义\n\n`
    markdown += `| 级别 | 说明 |\n|------|------|\n`
    markdown += `| Critical | 严重问题，可能导致功能失效、安全漏洞或重大兼容问题，必须立即修复 |\n`
    markdown += `| Error | 错误问题，不符合设计规范，可能影响功能或兼容性，建议尽快修复 |\n`
    markdown += `| Warning | 警告问题，存在潜在风险或不够规范，建议修复以提高代码质量 |\n`
    markdown += `| Info | 信息提示，不影响功能，但可以进一步优化或完善 |\n\n`

    markdown += `### 检查规则列表\n\n`
    markdown += `| 规则 ID | 规则名称 | 描述 |\n|---------|----------|------|\n`
    markdown += `| resource-naming | 资源命名规范 | 验证资源路径命名规范 |\n`
    markdown += `| http-method | HTTP 方法规范 | 验证 HTTP 方法使用是否正确 |\n`
    markdown += `| status-code | 状态码规范 | 验证 HTTP 状态码使用规范 |\n`
    markdown += `| pagination | 分页过滤规范 | 验证分页参数、排序参数设计 |\n`
    markdown += `| idempotency | 幂等键规范 | 验证幂等性设计 |\n`
    markdown += `| error-code | 错误码规范 | 验证错误响应格式 |\n`
    markdown += `| versioning | 版本兼容与废弃策略 | 验证 API 版本控制和废弃策略 |\n\n`

    return markdown
  }

  groupIssuesBySeverity(issues) {
    const groups = {}
    
    for (const issue of issues) {
      const severity = issue.severity || 'warning'
      if (!groups[severity]) {
        groups[severity] = []
      }
      groups[severity].push(issue)
    }

    return groups
  }

  groupIssuesByRule(issues) {
    const groups = {}
    
    for (const issue of issues) {
      const ruleId = issue.ruleId || 'unknown'
      if (!groups[ruleId]) {
        groups[ruleId] = {
          ruleId,
          ruleName: issue.ruleName,
          category: issue.category,
          count: 0,
          issues: []
        }
      }
      groups[ruleId].count++
      groups[ruleId].issues.push(issue)
    }

    return groups
  }

  groupIssuesByPath(issues) {
    const groups = {}
    
    for (const issue of issues) {
      const path = issue.path || 'unknown'
      if (!groups[path]) {
        groups[path] = {
          path,
          count: 0,
          issues: []
        }
      }
      groups[path].count++
      groups[path].issues.push(issue)
    }

    return groups
  }

  generateRecommendations(issues) {
    if (issues.length === 0) {
      return []
    }

    const recommendations = []
    const issuesByRule = this.groupIssuesByRule(issues)

    const severityPriority = {
      critical: 0,
      error: 1,
      warning: 2,
      info: 3
    }

    for (const [ruleId, group] of Object.entries(issuesByRule)) {
      const maxSeverity = group.issues.reduce((max, issue) => {
        return severityPriority[issue.severity] < severityPriority[max] ? issue.severity : max
      }, 'info')

      const affectedPaths = [...new Set(group.issues.map(i => i.path).filter(p => p))]
      
      const suggestion = group.issues[0]?.suggestion

      recommendations.push({
        ruleId,
        title: group.ruleName,
        count: group.count,
        maxSeverity,
        suggestion,
        affectedPaths: affectedPaths.slice(0, 10),
        category: group.category
      })
    }

    recommendations.sort((a, b) => {
      const priorityDiff = severityPriority[a.maxSeverity] - severityPriority[b.maxSeverity]
      if (priorityDiff !== 0) return priorityDiff
      return b.count - a.count
    })

    return recommendations
  }

  getScoreColor(score) {
    if (score >= 90) return 'success'
    if (score >= 70) return 'warning'
    return 'danger'
  }

  getScoreDescription(score) {
    if (score >= 90) return '优秀 - API 设计符合大部分规范'
    if (score >= 70) return '良好 - 存在一些需要改进的地方'
    if (score >= 50) return '一般 - 需要较多改进'
    if (score >= 30) return '较差 - 存在较多问题'
    return '不合格 - 存在严重问题，需要立即修复'
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'completed': return '✅'
      case 'running': return '⏳'
      case 'failed': return '❌'
      case 'pending': return '🕐'
      default: return '❓'
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'completed': return '已完成'
      case 'running': return '进行中'
      case 'failed': return '失败'
      case 'pending': return '待处理'
      default: return '未知'
    }
  }
}

const reportGenerator = new ReportGenerator()

module.exports = {
  ReportGenerator,
  reportGenerator
}