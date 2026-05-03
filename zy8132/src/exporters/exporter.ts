import { Subtitle, ProjectState, ExportReport, ValidationIssue } from '../types'
import { generateSRT } from '../parsers/srtParser'
import { formatTimeDisplay } from '../utils/timeUtils'
import { getIssueStats } from '../validators/subtitleValidator'

export function exportSubtitlesAsSRT(subtitles: Subtitle[]): string {
  return generateSRT(subtitles)
}

export function exportReviewReport(
  state: ProjectState,
  options: {
    includeSubtitleDetails?: boolean
    includeTimeline?: boolean
  } = {}
): string {
  const { includeSubtitleDetails = true, includeTimeline = true } = options
  const issueStats = getIssueStats(state.validationIssues)

  const report: string[] = []

  report.push('# 字幕对齐复核报告')
  report.push('')
  report.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`)
  if (state.projectName) {
    report.push(`**项目名称**: ${state.projectName}`)
  }
  report.push('')

  report.push('## 概览')
  report.push('')
  report.push('| 指标 | 数值 |')
  report.push('|------|------|')
  report.push(`| 总字幕数 | ${state.subtitles.length} |`)
  report.push(`| 已修改字幕数 | ${state.subtitles.filter(s => s.isModified).length} |`)
  report.push(`| 错误数 | ${issueStats.errors} |`)
  report.push(`| 警告数 | ${issueStats.warnings} |`)
  report.push(`| 提示数 | ${issueStats.infos} |`)
  report.push(`| 音频标记数 | ${state.audioMarkers.length} |`)
  report.push(`| 节目段落数 | ${state.programSegments.length} |`)
  report.push('')

  report.push('## 问题统计')
  report.push('')
  if (Object.keys(issueStats.byType).length > 0) {
    report.push('| 问题类型 | 数量 |')
    report.push('|----------|------|')
    for (const [type, count] of Object.entries(issueStats.byType)) {
      report.push(`| ${getIssueTypeLabel(type)} | ${count} |`)
    }
  } else {
    report.push('暂无检测到的问题。')
  }
  report.push('')

  if (includeTimeline && state.audioMarkers.length > 0) {
    report.push('## 时间轴统计')
    report.push('')
    
    const totalDuration = state.audioMarkers.reduce(
      (sum, m) => sum + (m.endTime - m.startTime),
      0
    )
    const speechDuration = state.audioMarkers
      .filter(m => m.type === 'speech')
      .reduce((sum, m) => sum + (m.endTime - m.startTime), 0)
    const silenceDuration = state.audioMarkers
      .filter(m => m.type === 'silence')
      .reduce((sum, m) => sum + (m.endTime - m.startTime), 0)

    report.push('| 统计项 | 时长(秒) | 占比 |')
    report.push('|--------|----------|------|')
    report.push(`| 总时长 | ${totalDuration.toFixed(3)} | 100% |`)
    report.push(`| 说话时长 | ${speechDuration.toFixed(3)} | ${((speechDuration / totalDuration) * 100).toFixed(1)}% |`)
    report.push(`| 静音时长 | ${silenceDuration.toFixed(3)} | ${((silenceDuration / totalDuration) * 100).toFixed(1)}% |`)
    report.push('')

    report.push('### 音频标记列表')
    report.push('')
    report.push('| 序号 | 类型 | 开始时间 | 结束时间 | 时长 |')
    report.push('|------|------|----------|----------|------|')
    state.audioMarkers.forEach((marker, index) => {
      const duration = marker.endTime - marker.startTime
      report.push(
        `| ${index + 1} | ${marker.type === 'speech' ? '说话' : '静音'} | ${formatTimeDisplay(marker.startTime)} | ${formatTimeDisplay(marker.endTime)} | ${duration.toFixed(3)}s |`
      )
    })
    report.push('')
  }

  if (state.programSegments.length > 0) {
    report.push('## 节目段落')
    report.push('')
    report.push('| 序号 | 段落名 | 类型 | 开始时间 | 结束时间 |')
    report.push('|------|--------|------|----------|----------|')
    state.programSegments.forEach((segment, index) => {
      report.push(
        `| ${index + 1} | ${segment.name} | ${segment.segmentType} | ${formatTimeDisplay(segment.startTime)} | ${formatTimeDisplay(segment.endTime)} |`
      )
    })
    report.push('')
  }

  report.push('## 问题详情')
  report.push('')
  if (state.validationIssues.length > 0) {
    const groupedIssues = groupIssuesBySubtitle(state.validationIssues)
    
    for (const [subtitleId, issues] of Object.entries(groupedIssues)) {
      const subtitle = state.subtitles.find(s => s.id === subtitleId)
      if (!subtitle) continue

      report.push(`### 字幕 #${subtitle.index}`)
      report.push('')
      report.push(`**时间**: ${formatTimeDisplay(subtitle.startTime)} - ${formatTimeDisplay(subtitle.endTime)}`)
      report.push(`**内容**: ${subtitle.text}`)
      if (subtitle.isModified) {
        report.push(`**状态**: ⚠️ 已修改`)
        report.push(`**原时间**: ${formatTimeDisplay(subtitle.originalStartTime!)} - ${formatTimeDisplay(subtitle.originalEndTime!)}`)
      }
      report.push('')
      
      for (const issue of issues) {
        const severityIcon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'
        report.push(`${severityIcon} **${getIssueTypeLabel(issue.type)}**`)
        report.push(`   - ${issue.message}`)
        if (issue.suggestion) {
          report.push(`   - 建议: ${issue.suggestion}`)
        }
        report.push('')
      }
    }
  } else {
    report.push('✅ 所有字幕通过校验，未发现问题。')
    report.push('')
  }

  if (includeSubtitleDetails) {
    report.push('## 字幕详情')
    report.push('')
    report.push('| 序号 | 开始时间 | 结束时间 | 内容 | 状态 |')
    report.push('|------|----------|----------|------|------|')
    state.subtitles.forEach(sub => {
      const status = sub.isModified ? '已修改' : '未修改'
      const hasIssue = state.validationIssues.some(i => i.subtitleId === sub.id)
      const statusIcon = hasIssue ? '⚠️' : sub.isModified ? '✏️' : '✅'
      report.push(
        `| ${sub.index} | ${formatTimeDisplay(sub.startTime)} | ${formatTimeDisplay(sub.endTime)} | ${sub.text.replace(/\n/g, ' ').substring(0, 30)}${sub.text.length > 30 ? '...' : ''} | ${statusIcon} ${status} |`
      )
    })
    report.push('')
  }

  report.push('---')
  report.push('')
  report.push('*此报告由「离线字幕对齐复核器」自动生成*')

  return report.join('\n')
}

function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    overlap_with_silence: '与静音区间重叠',
    overlap_between_subtitles: '字幕间重叠',
    cross_segment: '跨段落字幕',
    time_gap: '时间间隔',
    start_in_silence: '开始于静音',
    end_in_silence: '结束于静音',
  }
  return labels[type] || type
}

function groupIssuesBySubtitle(
  issues: ValidationIssue[]
): Record<string, ValidationIssue[]> {
  const grouped: Record<string, ValidationIssue[]> = {}
  
  for (const issue of issues) {
    if (!grouped[issue.subtitleId]) {
      grouped[issue.subtitleId] = []
    }
    grouped[issue.subtitleId].push(issue)
  }

  return grouped
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
