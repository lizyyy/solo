import Papa from 'papaparse'

export function exportIssuesCSV(issues, boreholes = []) {
  const flattenedIssues = issues.map(issue => ({
    ID: issue.id || '',
    类型: getTypeLabel(issue.type),
    严重程度: getSeverityLabel(issue.severity),
    问题类型: issue.code || '',
    标题: issue.title || '',
    详细信息: issue.message || '',
    钻孔编号: issue.borehole_id || '',
    箱号: formatBoxNumbers(issue),
    起始深度: formatNumber(issue.start_depth),
    结束深度: formatNumber(issue.end_depth),
    位置: issue.location || '',
    涉及箱数: getBoxCount(issue)
  }))
  
  const csv = Papa.unparse(flattenedIssues, {
    delimiter: ',',
    header: true,
    quotes: true
  })
  
  const bom = '\uFEFF'
  return bom + csv
}

export function exportReviewReportMD(issues, boreholes, coreBoxes, stats) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
  const issuesByBorehole = groupIssuesByBorehole(issues)
  const issuesByCode = groupIssuesByCode(issues)
  
  let report = `# 钻孔岩芯编录质量复核报告

**生成时间**: ${dateStr}

---

## 一、项目概览

| 项目 | 数量 |
|------|------|
| 钻孔总数 | ${boreholes.length} |
| 岩芯箱总数 | ${coreBoxes.length} |

---

## 二、问题统计

| 类型 | 数量 |
|------|------|
| 严重错误 | ${stats.errors} |
| 警告 | ${stats.warnings} |
| 提示信息 | ${stats.infos} |
| **总计** | **${stats.total}** |

---

## 三、问题分类统计

`
  
  issuesByCode.forEach((issues, code) => {
    const sample = issues[0]
    report += `### ${sample.title || code} (${issues.length}个)

`
    if (issues.length > 0) {
      report += `| 钻孔编号 | 位置 | 详细信息 |
|----------|------|----------|
`
      issues.slice(0, 10).forEach(issue => {
        report += `| ${issue.borehole_id || '全项目'} | ${issue.location || '-'} | ${issue.message} |
`
      })
      if (issues.length > 10) {
        report += `| ... | ... | 还有 ${issues.length - 10} 个类似问题 |
`
      }
    }
    report += `
`
  })
  
  report += `---

## 四、各钻孔问题详情

`
  
  boreholes.forEach(borehole => {
    const bhIssues = issuesByBorehole.get(borehole.borehole_id) || []
    const bhBoxes = coreBoxes.filter(b => b.borehole_id === borehole.borehole_id)
    
    report += `### ${borehole.borehole_id}

**位置**: ${borehole.location || '-'}  
**工程师**: ${borehole.engineer || '-'}  
**总深度**: ${borehole.total_depth}m  
**岩芯箱数**: ${bhBoxes.length}  
**问题数**: ${bhIssues.length} (错误: ${bhIssues.filter(i => i.type === 'error').length}, 警告: ${bhIssues.filter(i => i.type === 'warning').length})

`
    if (bhIssues.length > 0) {
      report += `| 类型 | 问题 | 位置 |
|------|------|------|
`
      bhIssues.forEach(issue => {
        report += `| ${getTypeLabel(issue.type)} | ${issue.title} | ${issue.location || '-'} |
`
      })
    } else {
      report += `✅ 该钻孔无问题。
`
    }
    report += `
`
  })
  
  report += `---

## 五、问题代码说明

| 代码 | 说明 | 严重程度 |
|------|------|----------|
| DEPTH_GAP | 深度断档 | 错误 |
| DEPTH_OVERLAP | 深度重叠 | 错误 |
| DUPLICATE_BOX_NUMBER | 箱号重复 | 错误 |
| RQD_OUT_OF_RANGE | RQD值超范围 | 错误 |
| RQD_INVALID | RQD值无效 | 错误 |
| RECOVERY_OUT_OF_RANGE | 取芯率超范围 | 警告 |
| RECOVERY_INVALID | 取芯率值无效 | 错误 |
| BOX_SEQUENCE_MISMATCH | 箱号顺序与深度不一致 | 警告 |
| MISSING_BOX_NUMBER | 缺失箱号 | 警告 |
| TOTAL_DEPTH_MISMATCH | 总深度不一致 | 警告 |
| NO_CORE_BOXES | 无岩芯箱数据 | 警告 |
| LITHOLOGY_VARIANT | 岩性命名不一致 | 警告 |
| LITHOLOGY_CROSS_BOREHOLE | 跨钻孔岩性统计 | 提示 |

---

## 六、建议

1. **优先处理错误级别问题**: 深度断档、箱号重复、RQD超范围等问题可能影响数据准确性，建议优先复核。
2. **统一岩性命名规范**: 检查是否存在岩性命名不一致的情况，建议使用统一的地质命名标准。
3. **检查深度连续性**: 确保岩芯箱的深度区间连续，无断档或重叠。
4. **验证RQD和取芯率**: 确认RQD值在0-100%范围内，取芯率数据合理。

---

*报告由钻孔岩芯编录质量复核工具自动生成*
`
  
  return report
}

export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, filename)
}

export function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
  downloadFile(blob, filename)
}

function downloadFile(blob, filename) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

function getTypeLabel(type) {
  const labels = {
    error: '错误',
    warning: '警告',
    info: '提示'
  }
  return labels[type] || type
}

function getSeverityLabel(severity) {
  const labels = {
    high: '高',
    medium: '中',
    low: '低'
  }
  return labels[severity] || severity || '-'
}

function formatNumber(num) {
  if (num === undefined || num === null) return '-'
  if (typeof num === 'number') return num.toFixed(2)
  return String(num)
}

function formatBoxNumbers(issue) {
  if (issue.box_number !== undefined) {
    return String(issue.box_number)
  }
  if (issue.box_numbers && issue.box_numbers.length > 0) {
    return issue.box_numbers.join(', ')
  }
  if (issue.affected_boxes && issue.affected_boxes.length > 0) {
    return issue.affected_boxes.join(', ')
  }
  return '-'
}

function getBoxCount(issue) {
  if (issue.box_number !== undefined) return 1
  if (issue.box_numbers) return issue.box_numbers.length
  if (issue.affected_boxes) return issue.affected_boxes.length
  return 0
}

function groupIssuesByBorehole(issues) {
  const map = new Map()
  
  issues.forEach(issue => {
    const key = issue.borehole_id || 'other'
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key).push(issue)
  })
  
  return map
}

function groupIssuesByCode(issues) {
  const map = new Map()
  
  issues.forEach(issue => {
    const key = issue.code || 'OTHER'
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key).push(issue)
  })
  
  return map
}
