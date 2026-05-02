import fs from 'fs/promises'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import type { ValidationIssue, Review, Project } from '../../src/types'

interface ExportData {
  project: Project
  issues: ValidationIssue[]
  reviews: Review[]
}

// 导出Markdown复盘单
export async function exportMarkdown(data: ExportData, savePath: string): Promise<string> {
  const { project, issues, reviews } = data
  
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
  }
  
  const statusEmoji: Record<string, string> = {
    confirmed: '✅',
    dismissed: '❌',
    needs_more_info: '❓',
    resolved: '✔️',
  }
  
  const typeNames: Record<string, string> = {
    prop_state_jump: '道具状态跳变',
    costume_missing: '服装缺记录',
    photo_missing: '照片证据缺失',
    reshoot_date_conflict: '补拍日期冲突',
    timeline_inconsistency: '时间线不一致',
    actor_schedule_conflict: '演员日程冲突',
    wound_continuity: '伤口连续性',
    makeup_continuity: '妆容连续性',
  }
  
  // 统计信息
  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const infoCount = issues.filter(i => i.severity === 'info').length
  
  const confirmedCount = reviews.filter(r => r.status === 'confirmed').length
  const dismissedCount = reviews.filter(r => r.status === 'dismissed').length
  const resolvedCount = reviews.filter(r => r.status === 'resolved').length
  const pendingCount = reviews.filter(r => r.status === 'needs_more_info').length
  
  let markdown = `# 连续性穿帮核对复盘单

## 项目信息

| 项目 | ${project.name} |
|------|------------------|
| 场景数量 | ${project.scenes.length} |
| 道具/服装记录 | ${project.propStatus.length} |
| 演员通告 | ${project.actorCalls.length} |
| 照片数量 | ${project.photos.length} |
| 分析时间 | ${dayjs().format('YYYY-MM-DD HH:mm:ss')} |

---

## 问题统计

| 严重级别 | 数量 |
|----------|------|
| 🔴 严重 | ${criticalCount} |
| 🟡 警告 | ${warningCount} |
| 🔵 信息 | ${infoCount} |
| **总计** | **${issues.length}** |

---

## 复核状态

| 状态 | 数量 |
|------|------|
| ✅ 已确认 | ${confirmedCount} |
| ❌ 已忽略 | ${dismissedCount} |
| ✔️ 已解决 | ${resolvedCount} |
| ❓ 待确认 | ${pendingCount} |

---

## 问题详情

`

  // 按严重程度分组
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  sortedIssues.forEach((issue, index) => {
    const review = reviews.find(r => r.issueId === issue.id)
    
    markdown += `### ${severityEmoji[issue.severity]} [${index + 1}] ${issue.title}

**类型**: ${typeNames[issue.type] || issue.type}  
**严重级别**: ${issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '信息'}  

**描述**:  
${issue.description}

**涉及场景**: ${issue.affectedScenes.length > 0 ? issue.affectedScenes.join(', ') : '无'}  
**涉及演员**: ${issue.affectedActors.length > 0 ? issue.affectedActors.join(', ') : '无'}  
**涉及道具**: ${issue.affectedProps.length > 0 ? issue.affectedProps.join(', ') : '无'}

`

    if (issue.evidence.length > 0) {
      markdown += `**证据**:

`
      issue.evidence.forEach((ev, i) => {
        markdown += `- [${ev.type}] ${ev.description}\n`
      })
      markdown += '\n'
    }

    markdown += `**建议**: ${issue.suggestion}

`

    if (review) {
      markdown += `**复核状态**: ${statusEmoji[review.status]} ${
        review.status === 'confirmed' ? '已确认' :
        review.status === 'dismissed' ? '已忽略' :
        review.status === 'resolved' ? '已解决' : '待确认'
      }  
**复核人**: ${review.reviewerName}  
**复核时间**: ${dayjs(review.updatedAt).format('YYYY-MM-DD HH:mm:ss')}  

`
      if (review.comment) {
        markdown += `**复核意见**:  
${review.comment}

`
      }
    } else {
      markdown += `**复核状态**: ⏳ 未复核

`
    }

    markdown += `---

`
  })

  markdown += `
---

## 附录

### 场景列表

| 场次号 | 场景名称 | 拍摄日期 | 剧情顺序 | 拍摄顺序 |
|--------|----------|----------|----------|----------|
`

  project.scenes.forEach(scene => {
    markdown += `| ${scene.sceneNumber} | ${scene.sceneName} | ${scene.shootDate} | ${scene.storyOrder} | ${scene.shootOrder} |\n`
  })

  await fs.writeFile(savePath, markdown, 'utf-8')
  return savePath
}

// 导出CSV问题表
export async function exportCSV(data: ExportData, savePath: string): Promise<string> {
  const { issues, reviews } = data
  
  const csvData = issues.map(issue => {
    const review = reviews.find(r => r.issueId === issue.id)
    
    return {
      '问题ID': issue.id,
      '标题': issue.title,
      '类型': {
        prop_state_jump: '道具状态跳变',
        costume_missing: '服装缺记录',
        photo_missing: '照片证据缺失',
        reshoot_date_conflict: '补拍日期冲突',
        timeline_inconsistency: '时间线不一致',
        actor_schedule_conflict: '演员日程冲突',
        wound_continuity: '伤口连续性',
        makeup_continuity: '妆容连续性',
      }[issue.type] || issue.type,
      '严重级别': {
        critical: '严重',
        warning: '警告',
        info: '信息',
      }[issue.severity],
      '描述': issue.description,
      '涉及场景': issue.affectedScenes.join('; '),
      '涉及演员': issue.affectedActors.join('; '),
      '涉及道具': issue.affectedProps.join('; '),
      '证据数量': issue.evidence.length,
      '建议': issue.suggestion,
      '复核状态': review ? {
        confirmed: '已确认',
        dismissed: '已忽略',
        resolved: '已解决',
        needs_more_info: '待确认',
      }[review.status] : '未复核',
      '复核人': review?.reviewerName || '',
      '复核意见': review?.comment || '',
      '发现时间': dayjs(issue.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      '复核时间': review ? dayjs(review.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '',
    }
  })
  
  const csv = Papa.unparse(csvData)
  await fs.writeFile(savePath, csv, 'utf-8')
  return savePath
}

// 导出JSON审计包
export async function exportJSON(data: ExportData, savePath: string): Promise<string> {
  const auditPackage = {
    version: '1.0.0',
    exportTime: dayjs().toISOString(),
    project: {
      id: data.project.id,
      name: data.project.name,
      description: data.project.description,
      createdAt: data.project.createdAt,
      updatedAt: data.project.updatedAt,
      sceneCount: data.project.scenes.length,
      propStatusCount: data.project.propStatus.length,
      actorCallCount: data.project.actorCalls.length,
      photoCount: data.project.photos.length,
    },
    summary: {
      totalIssues: data.issues.length,
      bySeverity: {
        critical: data.issues.filter(i => i.severity === 'critical').length,
        warning: data.issues.filter(i => i.severity === 'warning').length,
        info: data.issues.filter(i => i.severity === 'info').length,
      },
      byType: data.issues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      reviewStatus: {
        confirmed: data.reviews.filter(r => r.status === 'confirmed').length,
        dismissed: data.reviews.filter(r => r.status === 'dismissed').length,
        resolved: data.reviews.filter(r => r.status === 'resolved').length,
        needs_more_info: data.reviews.filter(r => r.status === 'needs_more_info').length,
        unreviewed: data.issues.length - data.reviews.length,
      },
    },
    issues: data.issues,
    reviews: data.reviews,
    scenes: data.project.scenes,
    propStatus: data.project.propStatus,
    actorCalls: data.project.actorCalls,
  }
  
  const json = JSON.stringify(auditPackage, null, 2)
  await fs.writeFile(savePath, json, 'utf-8')
  return savePath
}
