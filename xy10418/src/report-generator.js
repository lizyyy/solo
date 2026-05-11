const fs = require('fs')
const path = require('path')

class ReportGenerator {
  constructor(configManager) {
    this.config = configManager
  }

  generateReport(auditResult, options = {}) {
    const { format = 'json', filename = null } = options
    const reportDir = this.config.getReportDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const baseName = filename || `license-audit-report-${timestamp}`

    let content
    let ext

    switch (format.toLowerCase()) {
      case 'json':
        content = this.generateJsonReport(auditResult)
        ext = 'json'
        break
      case 'html':
        content = this.generateHtmlReport(auditResult)
        ext = 'html'
        break
      case 'markdown':
      case 'md':
        content = this.generateMarkdownReport(auditResult)
        ext = 'md'
        break
      case 'text':
      case 'txt':
        content = this.generateTextReport(auditResult)
        ext = 'txt'
        break
      default:
        throw new Error(`不支持的报告格式: ${format}`)
    }

    const filepath = path.join(reportDir, `${baseName}.${ext}`)
    fs.writeFileSync(filepath, content)
    return filepath
  }

  generateJsonReport(auditResult) {
    return JSON.stringify(auditResult, null, 2)
  }

  generateTextReport(auditResult) {
    const lines = []
    const summary = auditResult.summary

    lines.push('='.repeat(80))
    lines.push('                       依赖许可证审计报告')
    lines.push('='.repeat(80))
    lines.push('')
    lines.push(`扫描时间: ${auditResult.scanTime}`)
    lines.push(`扫描源: ${auditResult.source}`)
    lines.push(`审计状态: ${this.getStatusEmoji(auditResult.status)} ${auditResult.status}`)
    lines.push('')
    lines.push('-'.repeat(80))
    lines.push('                                   摘要')
    lines.push('-'.repeat(80))
    lines.push('')
    lines.push(`  总依赖数: ${summary.total}`)
    lines.push(`  直接依赖: ${summary.direct}`)
    lines.push(`  传递依赖: ${summary.transitive}`)
    lines.push('')
    lines.push(`  ✓ 允许: ${summary.allowed}`)
    lines.push(`  ⚠ 需确认: ${summary.needsConfirmation}`)
    lines.push(`  ✗ 禁止: ${summary.forbidden}`)
    lines.push(`  ? 未知: ${summary.unknown}`)
    lines.push(`  例外审批: ${summary.withExceptions}`)
    lines.push('')

    if (summary.warnings.length > 0) {
      lines.push('-'.repeat(80))
      lines.push('                                   警告')
      lines.push('-'.repeat(80))
      lines.push('')
      
      for (const warning of summary.warnings) {
        if (warning.type === 'duplicate_package') {
          lines.push(`  同名不同版本: ${warning.package}`)
          lines.push(`    版本: ${warning.versions.join(', ')}`)
          lines.push(`    许可证: ${warning.licenses.join(', ')}`)
          lines.push('')
        }
      }
    }

    if (auditResult.issues.length > 0) {
      lines.push('-'.repeat(80))
      lines.push('                                   问题')
      lines.push('-'.repeat(80))
      lines.push('')
      
      for (const issue of auditResult.issues) {
        const typeLabel = {
          forbidden: '禁止',
          needs_confirmation: '需确认',
          unknown: '未知'
        }[issue.severity] || issue.severity
        
        lines.push(`  [${typeLabel}] ${issue.package}@${issue.version}`)
        lines.push(`    许可证: ${issue.license}`)
        lines.push(`    原因: ${issue.reason}`)
        lines.push(`    类型: ${issue.isDirect ? '直接依赖' : '传递依赖'}`)
        if (issue.parent) {
          lines.push(`    父依赖: ${issue.parent}`)
        }
        lines.push('')
      }
    }

    const categories = [
      { key: 'forbidden', title: '禁止许可证' },
      { key: 'needsConfirmation', title: '需审批确认许可证' },
      { key: 'unknown', title: '未知许可证' },
      { key: 'allowed', title: '允许许可证' }
    ]

    for (const cat of categories) {
      const packages = auditResult.categorized[cat.key]
      if (packages.length > 0) {
        lines.push('-'.repeat(80))
        lines.push(`                               ${cat.title} (${packages.length})`)
        lines.push('-'.repeat(80))
        lines.push('')
        
        for (const pkg of packages) {
          const direct = pkg.isDirect ? '[直接]' : '[传递]'
          const exception = pkg.exception ? ' [例外审批]' : ''
          lines.push(`  ${direct} ${pkg.name}@${pkg.version}${exception}`)
          lines.push(`    许可证: ${pkg.normalizedLicense}`)
          lines.push(`    风险: ${pkg.risk}`)
          lines.push(`    原因: ${pkg.reason}`)
          if (pkg.parent) {
            lines.push(`    父依赖: ${pkg.parent}`)
          }
          if (pkg.exception) {
            lines.push(`    审批人: ${pkg.exception.approvedBy}`)
            lines.push(`    审批理由: ${pkg.exception.reason}`)
            if (pkg.exception.expiresAt) {
              lines.push(`    过期时间: ${pkg.exception.expiresAt}`)
            }
          }
          lines.push('')
        }
      }
    }

    lines.push('='.repeat(80))
    lines.push('                              报告结束')
    lines.push('='.repeat(80))

    return lines.join('\n')
  }

  generateMarkdownReport(auditResult) {
    const lines = []
    const summary = auditResult.summary

    lines.push('# 依赖许可证审计报告')
    lines.push('')
    lines.push(`**扫描时间**: ${auditResult.scanTime}`)
    lines.push('')
    lines.push(`**审计状态**: ${this.getStatusEmoji(auditResult.status)} ${auditResult.status}`)
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## 摘要')
    lines.push('')
    lines.push('| 统计项 | 数量 |')
    lines.push('|--------|------|')
    lines.push(`| 总依赖数 | ${summary.total} |`)
    lines.push(`| 直接依赖 | ${summary.direct} |`)
    lines.push(`| 传递依赖 | ${summary.transitive} |`)
    lines.push(`| ✓ 允许 | ${summary.allowed} |`)
    lines.push(`| ⚠ 需确认 | ${summary.needsConfirmation} |`)
    lines.push(`| ✗ 禁止 | ${summary.forbidden} |`)
    lines.push(`| ? 未知 | ${summary.unknown} |`)
    lines.push(`| 例外审批 | ${summary.withExceptions} |`)
    lines.push('')

    if (summary.warnings.length > 0) {
      lines.push('## 警告')
      lines.push('')
      
      for (const warning of summary.warnings) {
        if (warning.type === 'duplicate_package') {
          lines.push(`### 同名不同版本: ${warning.package}`)
          lines.push('')
          lines.push(`- 版本: ${warning.versions.join(', ')}`)
          lines.push(`- 许可证: ${warning.licenses.join(', ')}`)
          lines.push('')
        }
      }
    }

    if (auditResult.issues.length > 0) {
      lines.push('## 问题')
      lines.push('')
      
      for (const issue of auditResult.issues) {
        const typeLabel = {
          forbidden: '禁止',
          needs_confirmation: '需确认',
          unknown: '未知'
        }[issue.severity] || issue.severity
        
        lines.push(`### [${typeLabel}] ${issue.package}@${issue.version}`)
        lines.push('')
        lines.push(`- **许可证**: ${issue.license}`)
        lines.push(`- **原因**: ${issue.reason}`)
        lines.push(`- **类型**: ${issue.isDirect ? '直接依赖' : '传递依赖'}`)
        if (issue.parent) {
          lines.push(`- **父依赖**: ${issue.parent}`)
        }
        lines.push('')
      }
    }

    const categories = [
      { key: 'forbidden', title: '禁止许可证', emoji: '🚫' },
      { key: 'needsConfirmation', title: '需审批确认许可证', emoji: '⚠️' },
      { key: 'unknown', title: '未知许可证', emoji: '❓' },
      { key: 'allowed', title: '允许许可证', emoji: '✅' }
    ]

    for (const cat of categories) {
      const packages = auditResult.categorized[cat.key]
      if (packages.length > 0) {
        lines.push(`## ${cat.emoji} ${cat.title} (${packages.length})`)
        lines.push('')
        
        lines.push('| 包名 | 版本 | 许可证 | 风险 | 类型 |')
        lines.push('|------|------|--------|------|------|')
        
        for (const pkg of packages) {
          const direct = pkg.isDirect ? '直接' : '传递'
          const exception = pkg.exception ? ' [例外]' : ''
          lines.push(`| ${pkg.name} | ${pkg.version}${exception} | ${pkg.normalizedLicense} | ${pkg.risk} | ${direct} |`)
        }
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  generateHtmlReport(auditResult) {
    const summary = auditResult.summary
    const statusColor = this.getStatusColor(auditResult.status)
    
    const categories = [
      { key: 'forbidden', title: '禁止许可证', class: 'forbidden' },
      { key: 'needsConfirmation', title: '需审批确认许可证', class: 'needs-confirmation' },
      { key: 'unknown', title: '未知许可证', class: 'unknown' },
      { key: 'allowed', title: '允许许可证', class: 'allowed' }
    ]

    let categoriesHtml = ''
    for (const cat of categories) {
      const packages = auditResult.categorized[cat.key]
      if (packages.length > 0) {
        const rowsHtml = packages.map(pkg => `
          <tr>
            <td>${pkg.name}</td>
            <td>${pkg.version}${pkg.exception ? ' <span class="exception-tag">例外</span>' : ''}</td>
            <td>${pkg.normalizedLicense}</td>
            <td><span class="risk-${pkg.risk}">${pkg.risk}</span></td>
            <td>${pkg.isDirect ? '直接' : '传递'}</td>
            <td>${pkg.parent || '-'}</td>
          </tr>
        `).join('')
        
        categoriesHtml += `
          <section class="category ${cat.class}">
            <h2>${cat.title} <span class="count">(${packages.length})</span></h2>
            <table>
              <thead>
                <tr>
                  <th>包名</th>
                  <th>版本</th>
                  <th>许可证</th>
                  <th>风险</th>
                  <th>类型</th>
                  <th>父依赖</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </section>
        `
      }
    }

    let warningsHtml = ''
    if (summary.warnings.length > 0) {
      const warningsRows = summary.warnings.map(w => {
        if (w.type === 'duplicate_package') {
          return `
            <li>
              <strong>${w.package}</strong>: 版本 ${w.versions.join(', ')}, 许可证 ${w.licenses.join(', ')}
            </li>
          `
        }
        return ''
      }).join('')
      
      warningsHtml = `
        <section class="warnings">
          <h2>⚠️ 警告</h2>
          <ul>${warningsRows}</ul>
        </section>
      `
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>依赖许可证审计报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; margin-bottom: 20px; }
    .status { text-align: center; font-size: 1.2em; margin-bottom: 30px; }
    .status-badge { display: inline-block; padding: 8px 24px; border-radius: 20px; font-weight: bold; color: white; }
    .status-PASS { background: #28a745; }
    .status-WARN { background: #ffc107; color: #333; }
    .status-FAIL { background: #dc3545; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card .label { font-size: 0.9em; color: #666; }
    .summary-card .value { font-size: 1.8em; font-weight: bold; }
    .summary-card.allowed .value { color: #28a745; }
    .summary-card.needs-confirmation .value { color: #ffc107; }
    .summary-card.forbidden .value { color: #dc3545; }
    .summary-card.unknown .value { color: #17a2b8; }
    section { margin-bottom: 30px; }
    h2 { border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f5f5f5; }
    .exception-tag { background: #17a2b8; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
    .risk-low { color: #28a745; }
    .risk-medium { color: #ffc107; }
    .risk-high { color: #fd7e14; }
    .risk-critical { color: #dc3545; }
    .warnings { background: #fff3cd; padding: 20px; border-radius: 8px; }
    .warnings ul { margin-left: 20px; }
    .category.forbidden h2 { color: #dc3545; border-color: #dc3545; }
    .category.needs-confirmation h2 { color: #ffc107; border-color: #ffc107; }
    .category.unknown h2 { color: #17a2b8; border-color: #17a2b8; }
    .category.allowed h2 { color: #28a745; border-color: #28a745; }
    .count { font-size: 0.8em; font-weight: normal; color: #666; }
    .meta { text-align: center; color: #666; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>依赖许可证审计报告</h1>
  <div class="meta">
    <p>扫描时间: ${auditResult.scanTime}</p>
    <p>扫描源: ${auditResult.source}</p>
  </div>
  <div class="status">
    <span class="status-badge status-${auditResult.status}">${auditResult.status}</span>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="label">总依赖数</div>
      <div class="value">${summary.total}</div>
    </div>
    <div class="summary-card">
      <div class="label">直接依赖</div>
      <div class="value">${summary.direct}</div>
    </div>
    <div class="summary-card">
      <div class="label">传递依赖</div>
      <div class="value">${summary.transitive}</div>
    </div>
    <div class="summary-card allowed">
      <div class="label">✓ 允许</div>
      <div class="value">${summary.allowed}</div>
    </div>
    <div class="summary-card needs-confirmation">
      <div class="label">⚠ 需确认</div>
      <div class="value">${summary.needsConfirmation}</div>
    </div>
    <div class="summary-card forbidden">
      <div class="label">✗ 禁止</div>
      <div class="value">${summary.forbidden}</div>
    </div>
    <div class="summary-card unknown">
      <div class="label">? 未知</div>
      <div class="value">${summary.unknown}</div>
    </div>
  </div>
  
  ${warningsHtml}
  ${categoriesHtml}
</body>
</html>`
  }

  getStatusEmoji(status) {
    return {
      'PASS': '✓',
      'WARN': '⚠',
      'FAIL': '✗'
    }[status] || ''
  }

  getStatusColor(status) {
    return {
      'PASS': 'green',
      'WARN': 'yellow',
      'FAIL': 'red'
    }[status] || 'gray'
  }
}

module.exports = ReportGenerator
