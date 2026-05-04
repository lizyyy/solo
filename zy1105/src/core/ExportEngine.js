const fs = require('fs')
const path = require('path')

class ExportEngine {
  constructor(scanResult, checkResult, options = {}) {
    this.scanResult = scanResult
    this.checkResult = checkResult
    this.options = {
      projectName: options.projectName || 'Unnamed Project',
      projectVersion: options.projectVersion || 'unknown',
      outputDir: options.outputDir || process.cwd(),
      includeDetails: options.includeDetails ?? true,
      ...options
    }
  }

  export(format) {
    switch (format.toLowerCase()) {
      case 'json':
        return this.exportJson()
      case 'markdown':
      case 'md':
        return this.exportMarkdown()
      case 'html':
        return this.exportHtml()
      case 'notice':
        return this.exportNotice()
      default:
        throw new Error(`不支持的导出格式: ${format}。支持的格式: json, markdown, html, notice`)
    }
  }

  exportAll() {
    return {
      json: this.exportJson(),
      markdown: this.exportMarkdown(),
      html: this.exportHtml(),
      notice: this.exportNotice()
    }
  }

  exportJson() {
    const report = {
      meta: {
        exportedAt: new Date().toISOString(),
        projectName: this.options.projectName,
        projectVersion: this.options.projectVersion,
        tool: 'license-risk-checker',
        version: '1.0.0'
      },
      scanResult: this.scanResult,
      checkResult: this.checkResult
    }

    const outputPath = path.join(this.options.outputDir, 'license-report.json')
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')

    return {
      format: 'json',
      path: outputPath,
      content: JSON.stringify(report, null, 2)
    }
  }

  exportMarkdown() {
    const lines = []
    
    lines.push(`# 许可证合规检查报告`)
    lines.push('')
    lines.push(`**项目**: ${this.options.projectName}`)
    lines.push(`**版本**: ${this.options.projectVersion}`)
    lines.push(`**检查时间**: ${new Date().toLocaleString('zh-CN')}`)
    lines.push('')

    lines.push('## 概览')
    lines.push('')
    
    const overallRisk = this.checkResult?.overallRisk || 'UNKNOWN'
    const riskEmoji = {
      'SAFE': '✅',
      'LOW': '⚠️',
      'MEDIUM': '⚠️',
      'HIGH': '🚨',
      'CRITICAL': '🚨',
      'UNKNOWN': '❓'
    }
    
    lines.push(`**整体风险等级**: ${riskEmoji[overallRisk] || '❓'} ${this.getRiskDisplayName(overallRisk)}`)
    lines.push('')

    const stats = this.checkResult?.statistics || {}
    const deps = stats.totalDependencies || 0
    const riskLevels = stats.byRiskLevel || {}
    
    lines.push('| 风险等级 | 数量 |')
    lines.push('|----------|------|')
    lines.push(`| 🟢 安全 (SAFE) | ${riskLevels.SAFE || 0} |`)
    lines.push(`| 🟡 低风险 (LOW) | ${riskLevels.LOW || 0} |`)
    lines.push(`| 🟠 中风险 (MEDIUM) | ${riskLevels.MEDIUM || 0} |`)
    lines.push(`| 🔴 高风险 (HIGH) | ${riskLevels.HIGH || 0} |`)
    lines.push(`| ⚪ 未知 (UNKNOWN) | ${riskLevels.UNKNOWN || 0} |`)
    lines.push(`| **总计** | **${deps}** |`)
    lines.push('')

    const issues = this.checkResult?.issues || []
    if (issues.length > 0) {
      lines.push('## 发现的问题')
      lines.push('')
      
      const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
      
      for (const severity of severityOrder) {
        const severityIssues = issues.filter(i => i.severity === severity)
        if (severityIssues.length === 0) continue
        
        const displayName = {
          critical: '严重',
          high: '高',
          medium: '中',
          low: '低',
          info: '信息'
        }
        
        lines.push(`### ${displayName[severity]}优先级 (${severityIssues.length})`)
        lines.push('')
        
        for (const issue of severityIssues) {
          lines.push(`#### ${issue.message}`)
          lines.push('')
          
          if (issue.package) {
            lines.push(`- **包名**: ${issue.package}`)
          }
          if (issue.packages && issue.packages.length > 0) {
            lines.push(`- **涉及包**: ${issue.packages.map(p => p.name).join(', ')}`)
          }
          if (issue.version) {
            lines.push(`- **版本**: ${issue.version}`)
          }
          if (issue.license) {
            lines.push(`- **许可证**: ${issue.license}`)
          }
          if (issue.evidence) {
            lines.push(`- **证据**: ${issue.evidence}`)
          }
          if (issue.file) {
            lines.push(`- **文件**: ${issue.file}${issue.line ? ` (行 ${issue.line})` : ''}`)
          }
          
          if (issue.explanation) {
            lines.push('')
            lines.push('**说明**:')
            lines.push('')
            lines.push(issue.explanation.split('\n').map(l => `> ${l}`).join('\n'))
          }
          
          if (issue.requirements && issue.requirements.length > 0) {
            lines.push('')
            lines.push('**许可证要求**:')
            for (const req of issue.requirements) {
              lines.push(`- ${req}`)
            }
          }
          
          if (issue.risks && issue.risks.length > 0) {
            lines.push('')
            lines.push('**风险**:')
            for (const risk of issue.risks) {
              lines.push(`- ⚠️ ${risk}`)
            }
          }
          
          if (issue.requiredActions && issue.requiredActions.length > 0) {
            lines.push('')
            lines.push('**建议行动**:')
            for (const action of issue.requiredActions) {
              lines.push(`- [ ] ${action}`)
            }
          }
          
          lines.push('')
        }
      }
    }

    const recommendations = this.checkResult?.recommendations || []
    if (recommendations.length > 0) {
      lines.push('## 建议')
      lines.push('')
      
      for (const rec of recommendations) {
        const priorityEmoji = {
          high: '🔴',
          medium: '🟠',
          low: '🟡',
          info: 'ℹ️'
        }
        
        lines.push(`### ${priorityEmoji[rec.priority] || 'ℹ️'} ${rec.title}`)
        lines.push('')
        lines.push(rec.description)
        lines.push('')
        
        if (rec.actions && rec.actions.length > 0) {
          lines.push('**行动项**:')
          for (const action of rec.actions) {
            lines.push(`- [ ] ${action}`)
          }
          lines.push('')
        }
      }
    }

    const dependencies = this.scanResult?.dependencies || []
    if (dependencies.length > 0) {
      lines.push('## 依赖列表')
      lines.push('')
      
      const byRisk = this.groupByRiskLevel(dependencies)
      
      for (const level of ['HIGH', 'MEDIUM', 'LOW', 'SAFE', 'UNKNOWN']) {
        const deps = byRisk[level] || []
        if (deps.length === 0) continue
        
        const levelName = this.getRiskDisplayName(level)
        lines.push(`### ${this.getRiskEmoji(level)} ${levelName} (${deps.length})`)
        lines.push('')
        
        lines.push('| 包名 | 版本 | 许可证 | 来源 |')
        lines.push('|------|------|--------|------|')
        
        for (const dep of deps) {
          const name = dep.originalName || dep.name
          const version = dep.version || 'unknown'
          const license = dep.license || 'UNKNOWN'
          const source = dep.source || dep.sourceType || 'unknown'
          
          lines.push(`| ${name} | ${version} | ${license} | ${source} |`)
        }
        
        lines.push('')
      }

      if (this.options.includeDetails) {
        lines.push('## 详细依赖信息')
        lines.push('')
        
        for (const dep of dependencies) {
          const name = dep.originalName || dep.name
          const version = dep.version || 'unknown'
          
          lines.push(`### ${name}@${version}`)
          lines.push('')
          lines.push(`- **许可证**: ${dep.license || 'UNKNOWN'}`)
          lines.push(`- **标准化许可证**: ${dep.normalizedLicense || 'N/A'}`)
          lines.push(`- **风险等级**: ${this.getRiskEmoji(dep.riskLevel)} ${this.getRiskDisplayName(dep.riskLevel)}`)
          lines.push(`- **来源**: ${dep.source || dep.sourceType || 'unknown'}`)
          
          if (dep.isCopyleft) {
            lines.push(`- **Copyleft**: 是 ${dep.isNetworkServiceRisk ? '(AGPL - 网络服务风险)' : ''}`)
          }
          
          if (dep.requiresNotice) {
            lines.push(`- **需要 NOTICE**: 是`)
          }
          
          if (dep.requiresAttribution) {
            lines.push(`- **需要归因**: 是`)
          }
          
          if (dep.overridden) {
            lines.push(`- **许可证已覆盖**: 是 (来源: ${dep.licenseSource || 'overrides.json'})`)
          }
          
          if (dep.licenseInfo) {
            const info = dep.licenseInfo
            lines.push('')
            lines.push('**许可证说明**:')
            lines.push(`- ${info.summary || '无摘要'}`)
            
            if (info.requirements && info.requirements.length > 0) {
              lines.push('')
              lines.push('**要求**:')
              for (const req of info.requirements) {
                lines.push(`- ${req}`)
              }
            }
            
            if (info.risks && info.risks.length > 0) {
              lines.push('')
              lines.push('**风险**:')
              for (const risk of info.risks) {
                lines.push(`- ⚠️ ${risk}`)
              }
            }
          }
          
          lines.push('')
        }
      }
    }

    const content = lines.join('\n')
    const outputPath = path.join(this.options.outputDir, 'license-report.md')
    fs.writeFileSync(outputPath, content, 'utf-8')

    return {
      format: 'markdown',
      path: outputPath,
      content: content
    }
  }

  exportHtml() {
    const html = this.generateHtmlReport()
    const outputPath = path.join(this.options.outputDir, 'license-report.html')
    fs.writeFileSync(outputPath, html, 'utf-8')

    return {
      format: 'html',
      path: outputPath,
      content: html
    }
  }

  generateHtmlReport() {
    const overallRisk = this.checkResult?.overallRisk || 'UNKNOWN'
    const stats = this.checkResult?.statistics || {}
    const issues = this.checkResult?.issues || []
    const dependencies = this.scanResult?.dependencies || []
    const recommendations = this.checkResult?.recommendations || []

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>许可证合规检查报告 - ${this.options.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4 { margin-top: 1.5em; margin-bottom: 0.5em; color: #2c3e50; }
    h1 { font-size: 2em; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { font-size: 1.5em; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
    .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em; }
    .risk-safe { background: #d4edda; color: #155724; }
    .risk-low { background: #fff3cd; color: #856404; }
    .risk-medium { background: #ffeaa7; color: #d35400; }
    .risk-high { background: #f8d7da; color: #721c24; }
    .risk-unknown { background: #e9ecef; color: #495057; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .issue-card { border-left: 4px solid; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 0 5px 5px 0; }
    .issue-critical { border-color: #721c24; }
    .issue-high { border-color: #dc3545; }
    .issue-medium { border-color: #fd7e14; }
    .issue-low { border-color: #ffc107; }
    .issue-info { border-color: #17a2b8; }
    .explanation { background: #fff; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 10px 0; font-size: 0.95em; }
    .meta-info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
    .meta-info p { margin: 5px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; border: 1px solid #dee2e6; border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stat-card .number { font-size: 2em; font-weight: bold; display: block; }
    .stat-card .label { font-size: 0.9em; color: #6c757d; }
    .recommendation { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .priority-high { border-left: 4px solid #dc3545; }
    .priority-medium { border-left: 4px solid #fd7e14; }
    .priority-low { border-left: 4px solid #ffc107; }
    .priority-info { border-left: 4px solid #17a2b8; }
    ul, ol { margin-left: 25px; margin-top: 10px; margin-bottom: 10px; }
    li { margin: 5px 0; }
    .dep-section { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .dep-item { background: white; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 10px 0; }
    .dep-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .dep-name { font-weight: bold; font-size: 1.1em; }
    code { background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; }
  </style>
</head>
<body>
  <h1>🔍 许可证合规检查报告</h1>
  
  <div class="meta-info">
    <p><strong>项目:</strong> ${this.options.projectName}</p>
    <p><strong>版本:</strong> ${this.options.projectVersion}</p>
    <p><strong>检查时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
    <p><strong>整体风险:</strong> <span class="risk-badge risk-${overallRisk.toLowerCase()}">${this.getRiskDisplayName(overallRisk)}</span></p>
  </div>

  <h2>📊 统计概览</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <span class="number">${stats.totalDependencies || 0}</span>
      <span class="label">总依赖数</span>
    </div>
    <div class="stat-card">
      <span class="number" style="color: #155724;">${(stats.byRiskLevel?.SAFE || 0)}</span>
      <span class="label">安全</span>
    </div>
    <div class="stat-card">
      <span class="number" style="color: #856404;">${(stats.byRiskLevel?.LOW || 0)}</span>
      <span class="label">低风险</span>
    </div>
    <div class="stat-card">
      <span class="number" style="color: #d35400;">${(stats.byRiskLevel?.MEDIUM || 0)}</span>
      <span class="label">中风险</span>
    </div>
    <div class="stat-card">
      <span class="number" style="color: #721c24;">${(stats.byRiskLevel?.HIGH || 0)}</span>
      <span class="label">高风险</span>
    </div>
    <div class="stat-card">
      <span class="number" style="color: #495057;">${(stats.byRiskLevel?.UNKNOWN || 0)}</span>
      <span class="label">未知</span>
    </div>
  </div>

  ${issues.length > 0 ? this.generateIssuesHtml(issues) : ''}
  ${recommendations.length > 0 ? this.generateRecommendationsHtml(recommendations) : ''}
  ${dependencies.length > 0 ? this.generateDependenciesHtml(dependencies) : ''}

</body>
</html>`
  }

  generateIssuesHtml(issues) {
    if (issues.length === 0) return ''

    const severityGroups = {
      critical: issues.filter(i => i.severity === 'critical'),
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
      info: issues.filter(i => i.severity === 'info')
    }

    const severityNames = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
      info: '信息'
    }

    let html = '<h2>⚠️ 发现的问题</h2>\n'

    for (const [severity, items] of Object.entries(severityGroups)) {
      if (items.length === 0) continue

      html += `<h3>${severityNames[severity]}优先级 (${items.length})</h3>\n`

      for (const issue of items) {
        html += `<div class="issue-card issue-${severity}">\n`
        html += `<h4>${issue.message}</h4>\n`
        
        const details = []
        if (issue.package) details.push(`<strong>包名:</strong> <code>${issue.package}</code>`)
        if (issue.packages && issue.packages.length > 0) {
          details.push(`<strong>涉及包:</strong> ${issue.packages.map(p => `<code>${p.name}</code>`).join(', ')}`)
        }
        if (issue.version) details.push(`<strong>版本:</strong> <code>${issue.version}</code>`)
        if (issue.license) details.push(`<strong>许可证:</strong> <code>${issue.license}</code>`)
        if (issue.evidence) details.push(`<strong>证据:</strong> ${issue.evidence}`)
        if (issue.file) {
          details.push(`<strong>文件:</strong> ${issue.file}${issue.line ? ` (行 ${issue.line})` : ''}`)
        }
        
        if (details.length > 0) {
          html += `<p>${details.join(' | ')}</p>\n`
        }

        if (issue.explanation) {
          html += `<div class="explanation"><strong>说明:</strong><br>${issue.explanation.replace(/\n/g, '<br>')}</div>\n`
        }

        if (issue.requirements && issue.requirements.length > 0) {
          html += '<p><strong>许可证要求:</strong></p>\n<ul>\n'
          for (const req of issue.requirements) {
            html += `<li>${req}</li>\n`
          }
          html += '</ul>\n'
        }

        if (issue.risks && issue.risks.length > 0) {
          html += '<p><strong>风险:</strong></p>\n<ul>\n'
          for (const risk of issue.risks) {
            html += `<li>⚠️ ${risk}</li>\n`
          }
          html += '</ul>\n'
        }

        if (issue.requiredActions && issue.requiredActions.length > 0) {
          html += '<p><strong>建议行动:</strong></p>\n<ul>\n'
          for (const action of issue.requiredActions) {
            html += `<li>☐ ${action}</li>\n`
          }
          html += '</ul>\n'
        }

        html += '</div>\n'
      }
    }

    return html
  }

  generateRecommendationsHtml(recommendations) {
    let html = '<h2>💡 建议</h2>\n'

    const priorityNames = {
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
      info: '信息'
    }

    for (const rec of recommendations) {
      html += `<div class="recommendation priority-${rec.priority}">\n`
      html += `<h4>${priorityNames[rec.priority] || '信息'}: ${rec.title}</h4>\n`
      html += `<p>${rec.description}</p>\n`
      
      if (rec.actions && rec.actions.length > 0) {
        html += '<p><strong>行动项:</strong></p>\n<ul>\n'
        for (const action of rec.actions) {
          html += `<li>☐ ${action}</li>\n`
        }
        html += '</ul>\n'
      }
      
      html += '</div>\n'
    }

    return html
  }

  generateDependenciesHtml(dependencies) {
    const byRisk = this.groupByRiskLevel(dependencies)
    const riskOrder = ['HIGH', 'MEDIUM', 'LOW', 'SAFE', 'UNKNOWN']

    let html = '<h2>📦 依赖列表</h2>\n'

    for (const level of riskOrder) {
      const deps = byRisk[level] || []
      if (deps.length === 0) continue

      html += `<div class="dep-section">\n`
      html += `<h3>${this.getRiskEmoji(level)} ${this.getRiskDisplayName(level)} (${deps.length})</h3>\n`
      
      html += '<table>\n'
      html += '<tr><th>包名</th><th>版本</th><th>许可证</th><th>来源</th></tr>\n'
      
      for (const dep of deps) {
        const name = dep.originalName || dep.name
        const version = dep.version || 'unknown'
        const license = dep.license || 'UNKNOWN'
        const source = dep.source || dep.sourceType || 'unknown'
        
        html += `<tr><td><code>${name}</code></td><td>${version}</td><td><span class="risk-badge risk-${(dep.riskLevel || 'unknown').toLowerCase()}">${license}</span></td><td>${source}</td></tr>\n`
      }
      
      html += '</table>\n'
      html += '</div>\n'
    }

    return html
  }

  exportNotice() {
    const lines = []
    const year = new Date().getFullYear()
    
    lines.push(`NOTICE`)
    lines.push(`======`)
    lines.push('')
    lines.push(`${this.options.projectName}`)
    lines.push(`Copyright ${year}`)
    lines.push('')
    lines.push('='.repeat(60))
    lines.push('')
    lines.push('第三方组件声明')
    lines.push('------------------')
    lines.push('')

    const dependencies = this.scanResult?.dependencies || []
    const apacheDeps = dependencies.filter(dep => dep.requiresNotice)
    const attributionDeps = dependencies.filter(dep => dep.requiresAttribution && !dep.requiresNotice)

    if (apacheDeps.length > 0) {
      lines.push('以下组件使用 Apache-2.0 许可证，需要保留此 NOTICE 文件：')
      lines.push('')
      
      for (const dep of apacheDeps) {
        const name = dep.originalName || dep.name
        const version = dep.version || 'unknown'
        
        lines.push(`- ${name} ${version}`)
        lines.push(`  许可证: Apache-2.0`)
        
        if (dep.licenseInfo?.summary) {
          lines.push(`  ${dep.licenseInfo.summary}`)
        }
        
        if (dep.copyright || dep.sourceFile) {
          lines.push(`  来源: ${dep.source || dep.sourceType || 'unknown'}`)
        }
        
        lines.push('')
      }
    }

    if (attributionDeps.length > 0) {
      lines.push('')
      lines.push('以下组件需要归因声明：')
      lines.push('')
      
      const byLicense = {}
      for (const dep of attributionDeps) {
        const license = dep.normalizedLicense || dep.license || 'UNKNOWN'
        if (!byLicense[license]) {
          byLicense[license] = []
        }
        byLicense[license].push(dep)
      }
      
      for (const [license, deps] of Object.entries(byLicense)) {
        lines.push(`**${license} 许可证:**`)
        lines.push('')
        
        for (const dep of deps) {
          const name = dep.originalName || dep.name
          const version = dep.version || 'unknown'
          lines.push(`- ${name} ${version}`)
        }
        lines.push('')
      }
    }

    lines.push('')
    lines.push('='.repeat(60))
    lines.push('')
    lines.push('许可证摘要')
    lines.push('------------')
    lines.push('')

    const byRisk = this.groupByRiskLevel(dependencies)
    lines.push(`安全 (SAFE): ${byRisk.SAFE?.length || 0} 个`)
    lines.push(`低风险 (LOW): ${byRisk.LOW?.length || 0} 个`)
    lines.push(`中风险 (MEDIUM): ${byRisk.MEDIUM?.length || 0} 个`)
    lines.push(`高风险 (HIGH): ${byRisk.HIGH?.length || 0} 个`)
    lines.push(`未知 (UNKNOWN): ${byRisk.UNKNOWN?.length || 0} 个`)
    lines.push('')

    if (this.checkResult?.overallRisk && this.checkResult.overallRisk !== 'SAFE') {
      lines.push('⚠️ 注意：此项目存在非安全等级的依赖，请仔细审查上述列表。')
      lines.push('')
    }

    const content = lines.join('\n')
    const outputPath = path.join(this.options.outputDir, 'NOTICE')
    fs.writeFileSync(outputPath, content, 'utf-8')

    return {
      format: 'notice',
      path: outputPath,
      content: content
    }
  }

  groupByRiskLevel(dependencies) {
    const groups = {}
    for (const dep of dependencies) {
      const level = dep.riskLevel || 'UNKNOWN'
      if (!groups[level]) {
        groups[level] = []
      }
      groups[level].push(dep)
    }
    return groups
  }

  getRiskDisplayName(level) {
    const names = {
      'SAFE': '安全',
      'LOW': '低风险',
      'MEDIUM': '中风险',
      'HIGH': '高风险',
      'CRITICAL': '严重',
      'UNKNOWN': '未知'
    }
    return names[level] || '未知'
  }

  getRiskEmoji(level) {
    const emojis = {
      'SAFE': '🟢',
      'LOW': '🟡',
      'MEDIUM': '🟠',
      'HIGH': '🔴',
      'CRITICAL': '🚨',
      'UNKNOWN': '⚪'
    }
    return emojis[level] || '⚪'
  }

  writeToFile(content, filename) {
    const outputPath = path.join(this.options.outputDir, filename)
    fs.writeFileSync(outputPath, content, 'utf-8')
    return outputPath
  }
}

module.exports = ExportEngine
