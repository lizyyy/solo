export function exportIssuesToCSV(issues, fileName = 'issues.csv') {
  const headers = ['ID', '规则ID', '规则名称', '严重级别', '类型', '章节ID', '章节标题', '元素', '位置', '问题描述']

  const rows = issues.map(issue => [
    issue.id || '',
    issue.rule?.id || '',
    issue.rule?.name || '',
    issue.rule?.severity || '',
    issue.rule?.type || '',
    issue.chapterId || '',
    issue.chapterTitle || '',
    issue.element || '',
    issue.location || '',
    issue.message || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8')
}

export function exportSummaryToCSV(metadata, issuesBySeverity, issuesByChapter, fileName = 'summary.csv') {
  const headers = ['指标', '数值']
  const rows = [
    ['总问题数', String(issuesBySeverity.critical + issuesBySeverity.warning + issuesBySeverity.info)],
    ['严重问题', String(issuesBySeverity.critical)],
    ['警告问题', String(issuesBySeverity.warning)],
    ['信息', String(issuesBySeverity.info)],
    ['', ''],
    ['章节', '问题数']
  ]

  for (const item of issuesByChapter) {
    rows.push([item.chapterTitle, String(item.count)])
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8')
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
