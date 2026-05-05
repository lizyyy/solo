export class ExportService {
  constructor() {}

  generateMarkdownReview(alignedData, analysisResults, reviewService) {
    const competition = alignedData.competition || {}
    const summary = analysisResults?.summary || {}
    const reviews = reviewService?.getAllReviews() || {}
    const reviewsStats = reviewService?.getStatistics() || {}

    let md = `# 少儿体操积分赛 - 赛后复核报告
========================================

## 基本信息
| 项目 | 内容 |
|------|------|
| 赛事名称 | ${competition.name || '未知赛事'} |
| 组别 | ${competition.category || '未知组别'} |
| 日期 | ${competition.date || '未知日期'} |
| 地点 | ${competition.location || '未知地点'} |
| 复核时间 | ${new Date().toLocaleString('zh-CN')} |

---

## 复核概览
| 指标 | 数值 |
|------|------|
| 运动员总数 | ${alignedData.athletes?.length || 0} |
| 高优先级问题 | ${summary.highPriorityCount || 0} |
| 申诉总数 | ${summary.totalAppeals || 0} |
| 潜在命中申诉 | ${summary.hitAppeals || 0} |
| 重复申诉 | ${summary.duplicateAppeals || 0} |
| 风险等级 | ${this.getRiskLevelText(summary.riskLevel)} |
| 已完成复核 | ${reviewsStats.total || 0} |

---

## 一、裁判分数差异分析

`

    const scoreDiffs = analysisResults?.scoreDifferences?.issues || []
    if (scoreDiffs.length > 0) {
      md += `### 1.1 发现的问题 (${scoreDiffs.length} 项)

| # | 运动员 | 项目 | 问题类型 | 严重程度 | 详情 |
|---|--------|------|----------|----------|------|
`
      scoreDiffs.forEach((issue, index) => {
        md += `| ${index + 1} | ${issue.athleteName} | ${issue.event} | ${this.getIssueTypeText(issue.type)} | ${this.getSeverityText(issue.severity)} | ${issue.description} |\n`
      })

      md += `
### 1.2 详细问题说明

`
      scoreDiffs.forEach((issue, index) => {
        md += `#### ${index + 1}. ${issue.athleteName} - ${issue.event}

- **问题类型**: ${this.getIssueTypeText(issue.type)}
- **严重程度**: ${this.getSeverityText(issue.severity)}
- **描述**: ${issue.description}

`
        if (issue.details) {
          if (issue.details.judges) {
            md += `**裁判打分明细**:

| 裁判 | 难度分 | 执行分 | 扣分 | 总分 |
|------|--------|--------|------|------|
`
            issue.details.judges.forEach(j => {
              const judgeData = issue.details.judges.find(jd => jd.judge === j.judge) || {}
              md += `| ${j.judge} | ${j.score || '-'} | ${judgeData.execution || '-'} | ${judgeData.penalty || '-'} | ${judgeData.total || '-'} |\n`
            })
          }
          md += `\n`
        }

        const review = reviews.appeals?.find(r => r.appealId === issue.issueId) || 
                      reviews.issues?.find(r => r.issueId === `${issue.type}_${index}`)
        if (review && review.reviews?.length > 0) {
          const lastReview = review.reviews[review.reviews.length - 1]
          md += `**复核状态**: ${this.getStatusText(lastReview.status)}
**复核备注**: ${lastReview.notes || '无'}
**复核人**: ${lastReview.reviewer || '未指定'}

`
        }
      })
    } else {
      md += `未发现明显的裁判分数差异问题。\n\n`
    }

    md += `---

## 二、难度组别问题分析

`
    const difficultyIssues = analysisResults?.difficultyIssues?.issues || []
    if (difficultyIssues.length > 0) {
      md += `### 2.1 难度不匹配问题 (${difficultyIssues.length} 项)

| # | 运动员 | 项目 | 动作段 | 申报难度 | 申报分值 | 实际打分 | 差异 |
|---|--------|------|--------|----------|----------|----------|------|
`
      difficultyIssues.forEach((issue, index) => {
        const details = issue.details || {}
        md += `| ${index + 1} | ${issue.athleteName} | ${issue.event} | ${issue.segmentNumber} (${issue.segmentDescription}) | ${details.declaredDifficulty || '-'} | ${details.declaredValue || 0} | ${details.avgScoredDifficulty || 0} | ${details.difference || 0} |\n`
      })

      md += `\n### 2.2 详细说明

`
      difficultyIssues.forEach((issue, index) => {
        const details = issue.details || {}
        md += `#### ${index + 1}. ${issue.athleteName} - ${issue.event} - 动作段 ${issue.segmentNumber}

- **动作描述**: ${issue.segmentDescription}
- **申报难度组别**: ${details.declaredDifficulty || '未知'}
- **申报难度分值**: ${details.declaredValue || 0} 分
- **实际平均难度分**: ${details.avgScoredDifficulty || 0} 分
- **申报总分值**: ${details.totalDeclaredValue || 0} 分
- **分值差异**: ${details.difference || 0} 分
- **问题描述**: ${issue.description}

`
      })
    } else {
      md += `未发现难度组别申报与实际打分不匹配的问题。\n\n`
    }

    md += `---

## 三、申诉分析

`
    const appealAnalysis = analysisResults?.appealAnalysis || {}
    const hitAppeals = appealAnalysis.hitAppeals || []
    const pendingAppeals = appealAnalysis.pendingAppeals || []

    md += `### 3.1 申诉统计

| 类别 | 数量 |
|------|------|
| 总申诉数 | ${appealAnalysis.total || 0} |
| 潜在命中申诉 | ${hitAppeals.length} |
| 待复核申诉 | ${pendingAppeals.length} |

`

    if (hitAppeals.length > 0) {
      md += `### 3.2 潜在命中申诉

| # | 申诉编号 | 运动员 | 项目 | 申诉人 | 提交时间 | 命中原因 |
|---|----------|--------|------|--------|----------|----------|
`
      hitAppeals.forEach((appeal, index) => {
        md += `| ${index + 1} | ${appeal.appeal_id} | ${appeal.athleteName} | ${appeal.event} | ${appeal.submitter || '-'} | ${appeal.submit_time || '-'} | ${appeal.hitReason || '-'} |\n`
      })

      md += `
### 3.3 命中申诉详细内容

`
      hitAppeals.forEach((appeal, index) => {
        md += `#### ${index + 1}. 申诉 ${appeal.appeal_id} - ${appeal.athleteName}

- **运动员**: ${appeal.athleteName} (${appeal.athleteId})
- **项目**: ${appeal.event}
- **申诉人**: ${appeal.submitter || '未知'}
- **提交时间**: ${appeal.submit_time || '未知'}
- **相关动作段**: ${appeal.related_segment || '无'}
- **时间码**: ${appeal.timecodes?.start || '-'} - ${appeal.timecodes?.end || '-'}

**申诉内容**:
> ${appeal.complaint || '无'}

**证据**:
> ${appeal.evidence || '无'}

**命中分析**:
- ${appeal.hitReason || '未命中'}

`
        const review = reviews.appeals?.find(r => r.appealId === appeal.appeal_id)
        if (review && review.reviews?.length > 0) {
          const lastReview = review.reviews[review.reviews.length - 1]
          md += `**复核状态**: ${this.getStatusText(lastReview.status)}
**复核决定**: ${lastReview.decision || '未决定'}
**复核原因**: ${lastReview.decisionReason || '无'}
**分数调整**: ${lastReview.scoreAdjustment || '无'}
**复核备注**: ${lastReview.notes || '无'}

`
        }
      })
    }

    if (pendingAppeals.length > 0) {
      md += `### 3.4 待复核申诉 (无明确关联问题)

| # | 申诉编号 | 运动员 | 项目 | 申诉人 | 申诉摘要 |
|---|----------|--------|------|--------|----------|
`
      pendingAppeals.forEach((appeal, index) => {
        const shortComplaint = appeal.complaint?.substring(0, 50) + (appeal.complaint?.length > 50 ? '...' : '')
        md += `| ${index + 1} | ${appeal.appeal_id} | ${appeal.athleteName} | ${appeal.event} | ${appeal.submitter || '-'} | ${shortComplaint || '-'} |\n`
      })
      md += `\n`
    }

    md += `---

## 四、重复申诉检测

`
    const duplicateAppeals = analysisResults?.duplicateAppeals?.duplicates || []
    if (duplicateAppeals.length > 0) {
      md += `### 4.1 检测到的重复申诉 (${duplicateAppeals.length} 项)

| # | 运动员 | 项目 | 类型 | 详情 |
|---|--------|------|------|------|
`
      duplicateAppeals.forEach((dup, index) => {
        let detail = ''
        if (dup.type === 'duplicate_appeal') {
          detail = `申诉 ${dup.duplicateAppealId} 是 ${dup.originalAppealId} 的重复申诉`
        } else if (dup.appeal1 && dup.appeal2) {
          detail = `申诉 ${dup.appeal1.id} 与 ${dup.appeal2.id} 时间码重叠`
        }
        md += `| ${index + 1} | ${dup.athleteName} | ${dup.event} | ${dup.type === 'duplicate_appeal' ? '已标记重复' : '潜在重复'} | ${detail} |\n`
      })

      md += `
### 4.2 详细说明

`
      duplicateAppeals.forEach((dup, index) => {
        md += `#### ${index + 1}. ${dup.athleteName} - ${dup.event}

- **问题类型**: ${dup.type === 'duplicate_appeal' ? '已标记重复申诉' : '潜在重复申诉'}
- **描述**: ${dup.description}

`
        if (dup.type === 'duplicate_appeal') {
          md += `- **重复申诉编号**: ${dup.duplicateAppealId}
- **原始申诉编号**: ${dup.originalAppealId}
- **申诉人**: ${dup.submitter || '-'}
- **提交时间**: ${dup.submitTime || '-'}
- **时间码**: ${dup.timecodes?.start || '-'} - ${dup.timecodes?.end || '-'}

**申诉内容**:
> ${dup.complaint || '无'}

`
        } else if (dup.appeal1 && dup.appeal2) {
          md += `**申诉1**:
- 编号: ${dup.appeal1.id}
- 申诉人: ${dup.appeal1.submitter || '-'}
- 提交时间: ${dup.appeal1.submitTime || '-'}
- 时间码: ${dup.appeal1.timecodes?.start || '-'} - ${dup.appeal1.timecodes?.end || '-'}

**申诉2**:
- 编号: ${dup.appeal2.id}
- 申诉人: ${dup.appeal2.submitter || '-'}
- 提交时间: ${dup.appeal2.submitTime || '-'}
- 时间码: ${dup.appeal2.timecodes?.start || '-'} - ${dup.appeal2.timecodes?.end || '-'}

`
        }
      })
    } else {
      md += `未检测到重复申诉。\n\n`
    }

    md += `---

## 五、排名影响分析

`
    const rankingImpact = analysisResults?.rankingImpact || {}
    const currentRanking = rankingImpact.currentRanking || []
    const rankRisks = rankingImpact.rankRisks || []
    const appealImpact = rankingImpact.appealImpact || []

    md += `### 5.1 当前排名

| 排名 | 运动员 | 队伍 | 总分 |
|------|--------|------|------|
`
    currentRanking.forEach((athlete) => {
      md += `| ${athlete.rank} | ${athlete.name} | ${athlete.team || '-'} | ${athlete.totalScore} |\n`
    })

    if (rankRisks.length > 0) {
      md += `
### 5.2 排名风险 (分差较小的运动员对)

`
      rankRisks.forEach((risk, index) => {
        md += `#### ${index + 1}. ${risk.description}

| 运动员 | 当前排名 | 当前分数 | 队伍 |
|--------|----------|----------|------|
`
        risk.athletes?.forEach(a => {
          md += `| ${a.name} | 第${a.rank}名 | ${a.score.toFixed(2)} | ${a.team || '-'} |\n`
        })
        md += `\n- **分差**: ${risk.scoreDifference} 分
- **风险说明**: ${risk.note}

`
      })
    }

    if (appealImpact.length > 0) {
      md += `### 5.3 申诉可能带来的排名变化

`
      appealImpact.forEach((impact, index) => {
        md += `#### ${index + 1}. ${impact.athleteName}

- **当前排名**: 第${impact.currentRank}名
- **当前分数**: ${impact.currentScore.toFixed(2)} 分
- **潜在加分**: ${impact.potentialGain} 分
- **潜在总分**: ${impact.potentialScore} 分

**可能超越的运动员**:

| 运动员 | 当前排名 | 当前分数 |
|--------|----------|----------|
`
        impact.potentialOvertake?.forEach(a => {
          md += `| ${a.name} | 第${a.rank}名 | ${a.score.toFixed(2)} |\n`
        })
        md += `\n**相关申诉**:
- 申诉编号: ${impact.relatedAppeal?.id || '-'}
- 项目: ${impact.relatedAppeal?.event || '-'}
- 申诉内容: ${impact.relatedAppeal?.complaint?.substring(0, 100) || '-'}...

`
      })
    }

    md += `---

## 六、复核结论与建议

### 6.1 复核总结

根据本次复核分析，发现以下主要问题：

`

    if (summary.highPriorityCount > 0) {
      md += `- **高优先级问题**: ${summary.highPriorityCount} 项，需要优先处理
`
    }
    if (summary.hitAppeals > 0) {
      md += `- **潜在命中申诉**: ${summary.hitAppeals} 项，建议详细复核
`
    }
    if (summary.duplicateAppeals > 0) {
      md += `- **重复申诉**: ${summary.duplicateAppeals} 项，建议合并处理
`
    }

    md += `
### 6.2 处理建议

`
    if (summary.riskLevel === 'high') {
      md += `⚠️ **高风险**: 建议立即组织复核委员会对所有高优先级问题进行审查。
`
    } else if (summary.riskLevel === 'medium') {
      md += `⚠️ **中风险**: 建议按计划对发现的问题逐一复核。
`
    } else {
      md += `✅ **低风险**: 数据整体质量良好，可按常规流程处理。
`
    }

    md += `
### 6.3 复核记录统计

| 类型 | 数量 |
|------|------|
| 申诉复核 | ${reviewsStats.byType?.appeals || 0} |
| 问题复核 | ${reviewsStats.byType?.issues || 0} |
| 运动员备注 | ${reviewsStats.byType?.athletes || 0} |

`

    md += `---

## 附录

### A. 数据来源

本报告基于以下数据生成：
- 运动员信息: ${alignedData.athletes?.length || 0} 条记录
- 裁判分数: ${alignedData.rawData?.judgeScores?.length || 0} 条记录
- 难度申报: ${alignedData.rawData?.difficultyDeclarations?.declarations?.length || 0} 条记录
- 视频时间码: ${alignedData.rawData?.videoTimecodes?.videos?.length || 0} 条记录
- 申诉记录: ${alignedData.rawData?.appeals?.appeals?.length || 0} 条记录

### B. 复核工具信息

- 工具版本: 1.0.0
- 报告生成时间: ${new Date().toISOString()}
- 复核报告编号: REV-${Date.now().toString(36).toUpperCase()}

---

*本报告由少儿体操积分赛赛后复核工具自动生成。
`

    return md
  }

  generateJSONAudit(alignedData, analysisResults, reviewService) {
    const audit = {
      auditId: `AUD-${Date.now().toString(36).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      competition: alignedData.competition || {},
      
      rawDataSummary: {
        athletesCount: alignedData.athletes?.length || 0,
        judgeScoresCount: alignedData.rawData?.judgeScores?.length || 0,
        declarationsCount: alignedData.rawData?.difficultyDeclarations?.declarations?.length || 0,
        videosCount: alignedData.rawData?.videoTimecodes?.videos?.length || 0,
        appealsCount: alignedData.rawData?.appeals?.appeals?.length || 0
      },

      analysisResults: {
        summary: analysisResults?.summary || {},
        scoreDifferences: {
          threshold: analysisResults?.scoreDifferences?.threshold || {},
          issues: analysisResults?.scoreDifferences?.issues || []
        },
        difficultyIssues: analysisResults?.difficultyIssues || {},
        appealAnalysis: {
          total: analysisResults?.appealAnalysis?.total || 0,
          hitAppeals: analysisResults?.appealAnalysis?.hitAppeals?.map(a => ({
            ...a,
            relatedIssues: a.relatedIssues || []
          })) || [],
          pendingAppeals: analysisResults?.appealAnalysis?.pendingAppeals || []
        },
        duplicateAppeals: analysisResults?.duplicateAppeals || {},
        rankingImpact: analysisResults?.rankingImpact || {}
      },

      reviewRecords: reviewService?.exportReviews() || {},

      alignedDataSnapshot: {
        athletes: alignedData.athletes?.map(a => ({
          id: a.id,
          name: a.name,
          age: a.age,
          team: a.team,
          rank: a.rank,
          totalScore: a.totalScore,
          events: a.events?.map(e => ({
            event: e.event,
            scoreStats: e.scoreStats,
            segments: e.segments?.map(s => ({
              segmentNumber: s.segmentNumber,
              description: s.description,
              declaration: s.declaration,
              timecode: s.timecode,
              appealsCount: s.appeals?.length || 0
            })),
            appealsCount: e.appeals?.length || 0
          }))
        })) || []
      },

      auditTrail: {
        dataLoadedAt: null,
        analysisCompletedAt: new Date().toISOString(),
        reviewUpdates: reviewService?.getAllReviews()?.appeals?.map(r => ({
          type: r.type,
          itemId: r.appealId || r.issueId,
          lastUpdated: r.updatedAt
        })) || []
      }
    }

    return JSON.stringify(audit, null, 2)
  }

  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  getRiskLevelText(level) {
    const map = {
      'high': '高风险 ⚠️',
      'medium': '中风险',
      'low': '低风险 ✅'
    }
    return map[level] || '未知'
  }

  getSeverityText(severity) {
    const map = {
      'high': '高',
      'medium': '中',
      'low': '低'
    }
    return map[severity] || '未知'
  }

  getIssueTypeText(type) {
    const map = {
      'difficulty_diff': '难度分差异',
      'execution_diff': '执行分差异',
      'total_diff': '总分差异',
      'difficulty_mismatch': '难度不匹配'
    }
    return map[type] || type
  }

  getStatusText(status) {
    const map = {
      'pending': '待复核',
      'in_progress': '复核中',
      'resolved': '已解决',
      'rejected': '已驳回'
    }
    return map[status] || '未知'
  }
}

export default ExportService
