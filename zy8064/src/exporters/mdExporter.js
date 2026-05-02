export function exportIssuesToMarkdown(issues, metadata, issuesBySeverity, fileName = 'summary.md') {
  let md = ''

  md += `# EPUB 无障碍巡检报告\n\n`

  if (metadata) {
    md += `## 文档信息\n\n`
    md += `- **标题**: ${metadata.title || '未知'}\n`
    md += `- **作者**: ${metadata.creator || '未知'}\n`
    md += `- **语言**: ${metadata.language || '未知'}\n`
    md += `- **标识符**: ${metadata.identifier || '未知'}\n\n`
  }

  md += `## 问题概览\n\n`
  md += `| 严重级别 | 数量 |\n`
  md += `|---------|------|\n`
  md += `| 🔴 严重 (Critical) | ${issuesBySeverity.critical} |\n`
  md += `| 🟠 警告 (Warning) | ${issuesBySeverity.warning} |\n`
  md += `| 🔵 信息 (Info) | ${issuesBySeverity.info} |\n`
  md += `| **总计** | **${issuesBySeverity.critical + issuesBySeverity.warning + issuesBySeverity.info}** |\n\n`

  const criticalIssues = issues.filter(i => i.rule?.severity === 'critical')
  if (criticalIssues.length > 0) {
    md += `## 🔴 严重问题 (需要立即修复)\n\n`
    for (const issue of criticalIssues) {
      md += `### ${issue.rule?.name || '未知规则'}\n`
      md += `- **规则ID**: ${issue.rule?.id || 'N/A'}\n`
      md += `- **章节**: ${issue.chapterTitle || '全局'}\n`
      md += `- **位置**: ${issue.location || 'N/A'}\n`
      md += `- **描述**: ${issue.message || '无描述'}\n\n`
    }
  }

  const warningIssues = issues.filter(i => i.rule?.severity === 'warning')
  if (warningIssues.length > 0) {
    md += `## 🟠 警告问题 (建议修复)\n\n`
    for (const issue of warningIssues) {
      md += `### ${issue.rule?.name || '未知规则'}\n`
      md += `- **规则ID**: ${issue.rule?.id || 'N/A'}\n`
      md += `- **章节**: ${issue.chapterTitle || '全局'}\n`
      md += `- **位置**: ${issue.location || 'N/A'}\n`
      md += `- **描述**: ${issue.message || '无描述'}\n\n`
    }
  }

  md += `---\n\n`
  md += `*本报告由 EPUB 无障碍巡检工具自动生成*\n`

  downloadMarkdownFile(md, fileName)
}

export function exportSummaryToMarkdown(metadata, issuesBySeverity, issuesByChapter, fileName = 'summary.md') {
  let md = ''

  md += `# EPUB 无障碍巡检摘要\n\n`

  if (metadata) {
    md += `## 文档信息\n\n`
    md += `- **标题**: ${metadata.title || '未知'}\n`
    md += `- **作者**: ${metadata.creator || '未知'}\n`
    md += `- **语言**: ${metadata.language || '未知'}\n\n`
  }

  md += `## 统计摘要\n\n`
  md += `- **严重问题**: ${issuesBySeverity.critical}\n`
  md += `- **警告问题**: ${issuesBySeverity.warning}\n`
  md += `- **总计问题**: ${issuesBySeverity.critical + issuesBySeverity.warning + issuesBySeverity.info}\n\n`

  if (issuesByChapter.length > 0) {
    md += `## 按章节分布\n\n`
    md += `| 章节 | 问题数 | 严重 | 警告 |\n`
    md += `|-----|-------|-----|-----|\n`
    for (const item of issuesByChapter) {
      md += `| ${item.chapterTitle} | ${item.count} | ${item.critical} | ${item.warning} |\n`
    }
    md += `\n`
  }

  md += `---\n\n`
  md += `*本报告由 EPUB 无障碍巡检工具自动生成*\n`

  downloadMarkdownFile(md, fileName)
}

function downloadMarkdownFile(content, fileName) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
