export class AnalyticsEngine {
  constructor() {
    this.alignedData = null
    this.analysisResults = null
  }

  setAlignedData(data) {
    this.alignedData = data
  }

  analyze() {
    if (!this.alignedData) {
      throw new Error('请先设置对齐的数据')
    }

    const scoreDifferences = this.analyzeScoreDifferences()
    const difficultyIssues = this.analyzeDifficultyIssues()
    const appealAnalysis = this.analyzeAppeals()
    const rankingImpact = this.analyzeRankingImpact()
    const duplicateAppeals = this.detectDuplicateAppeals()

    this.analysisResults = {
      scoreDifferences,
      difficultyIssues,
      appealAnalysis,
      rankingImpact,
      duplicateAppeals,
      summary: this.generateSummary({
        scoreDifferences,
        difficultyIssues,
        appealAnalysis,
        duplicateAppeals
      })
    }

    return this.analysisResults
  }

  analyzeScoreDifferences() {
    const issues = []
    const threshold = {
      difficulty: 0.2,
      execution: 0.3,
      total: 0.5
    }

    for (const athlete of this.alignedData.athletes) {
      for (const event of athlete.events) {
        const stats = event.scoreStats
        if (!stats) continue

        if (stats.difficulty.variance > 0.01 || 
            (stats.difficulty.max - stats.difficulty.min > threshold.difficulty)) {
          issues.push({
            type: 'difficulty_diff',
            severity: this.getSeverity(stats.difficulty.max - stats.difficulty.min, threshold.difficulty),
            athleteId: athlete.id,
            athleteName: athlete.name,
            event: event.event,
            description: '难度分裁判差异较大',
            details: {
              max: stats.difficulty.max,
              min: stats.difficulty.min,
              variance: stats.difficulty.variance.toFixed(4),
              judges: event.scores.map(s => ({
                judge: s.judge_id,
                score: s.difficulty_score
              }))
            }
          })
        }

        if (stats.execution.variance > 0.05 ||
            (stats.execution.max - stats.execution.min > threshold.execution)) {
          issues.push({
            type: 'execution_diff',
            severity: this.getSeverity(stats.execution.max - stats.execution.min, threshold.execution),
            athleteId: athlete.id,
            athleteName: athlete.name,
            event: event.event,
            description: '执行分裁判差异较大',
            details: {
              max: stats.execution.max,
              min: stats.execution.min,
              variance: stats.execution.variance.toFixed(4),
              judges: event.scores.map(s => ({
                judge: s.judge_id,
                score: s.execution_score
              }))
            }
          })
        }

        if (stats.total.max - stats.total.min > threshold.total) {
          issues.push({
            type: 'total_diff',
            severity: this.getSeverity(stats.total.max - stats.total.min, threshold.total),
            athleteId: athlete.id,
            athleteName: athlete.name,
            event: event.event,
            description: '总分裁判差异较大',
            details: {
              max: stats.total.max,
              min: stats.total.min,
              diff: (stats.total.max - stats.total.min).toFixed(2),
              judges: event.scores.map(s => ({
                judge: s.judge_id,
                total: s.total_score,
                difficulty: s.difficulty_score,
                execution: s.execution_score,
                penalty: s.penalty_score
              }))
            }
          })
        }
      }
    }

    return {
      issues: issues.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.severity] - order[b.severity]
      }),
      threshold
    }
  }

  analyzeDifficultyIssues() {
    const issues = []

    for (const athlete of this.alignedData.athletes) {
      for (const event of athlete.events) {
        if (!event.declaration || !event.segments) continue

        for (const segment of event.segments) {
          if (!segment.declaration) continue

          const eventScores = event.scores
          const avgDifficulty = event.scoreStats?.difficulty?.avg || 0

          const declaredSum = event.declaration.segments.reduce(
            (sum, seg) => sum + (seg.declared_value || 0), 0
          )

          if (Math.abs(avgDifficulty - declaredSum) > 0.1) {
            issues.push({
              type: 'difficulty_mismatch',
              severity: 'high',
              athleteId: athlete.id,
              athleteName: athlete.name,
              event: event.event,
              segmentNumber: segment.segmentNumber,
              segmentDescription: segment.description,
              description: '申报难度与实际打分不匹配',
              details: {
                declaredDifficulty: segment.declaration.declared_difficulty,
                declaredValue: segment.declaration.declared_value,
                totalDeclaredValue: declaredSum,
                avgScoredDifficulty: avgDifficulty,
                difference: (avgDifficulty - declaredSum).toFixed(2)
              }
            })
          }
        }
      }
    }

    return {
      issues,
      count: issues.length
    }
  }

  analyzeAppeals() {
    const allAppeals = []
    const hitAppeals = []
    const pendingAppeals = []

    for (const athlete of this.alignedData.athletes) {
      for (const event of athlete.events) {
        if (!event.appeals || event.appeals.length === 0) continue

        for (const appeal of event.appeals) {
          const appealData = {
            ...appeal,
            athleteId: athlete.id,
            athleteName: athlete.name,
            event: event.event,
            potentialHit: false,
            hitReason: null
          }

          if (appeal.complaint.includes('难度') || appeal.complaint.includes('difficult')) {
            const scoreDiffs = this.analysisResults?.scoreDifferences?.issues?.filter(
              i => i.athleteId === athlete.id && i.event === event.event && 
                   (i.type === 'difficulty_diff' || i.type === 'difficulty_mismatch')
            ) || []

            if (scoreDiffs.length > 0) {
              appealData.potentialHit = true
              appealData.hitReason = '存在难度分裁判差异或申报不匹配问题'
              appealData.relatedIssues = scoreDiffs
              hitAppeals.push(appealData)
            }
          }

          if (appeal.complaint.includes('扣分') || appeal.complaint.includes('扣')) {
            const penalties = event.scores.filter(s => s.penalty_score > 0)
            if (penalties.length > 0) {
              appealData.potentialHit = true
              appealData.hitReason = `存在扣分记录: ${penalties.map(p => p.penalty_score).join(', ')}分`
              appealData.penaltyDetails = penalties
              if (!hitAppeals.includes(appealData)) {
                hitAppeals.push(appealData)
              }
            }
          }

          if (!appealData.potentialHit) {
            pendingAppeals.push(appealData)
          }

          allAppeals.push(appealData)
        }
      }
    }

    return {
      total: allAppeals.length,
      hitAppeals,
      pendingAppeals,
      allAppeals
    }
  }

  detectDuplicateAppeals() {
    const duplicates = []
    const appealGroups = new Map()

    for (const athlete of this.alignedData.athletes) {
      for (const event of athlete.events) {
        if (!event.appeals || event.appeals.length < 2) continue

        for (const appeal of event.appeals) {
          if (appeal.is_duplicate) {
            duplicates.push({
              type: 'duplicate_appeal',
              severity: 'medium',
              athleteId: athlete.id,
              athleteName: athlete.name,
              event: event.event,
              duplicateAppealId: appeal.appeal_id,
              originalAppealId: appeal.original_appeal_id,
              submitter: appeal.submitter,
              submitTime: appeal.submit_time,
              timecodes: appeal.timecodes,
              description: '同一段动作被重复申诉',
              complaint: appeal.complaint
            })
          }
        }

        for (let i = 0; i < event.appeals.length; i++) {
          for (let j = i + 1; j < event.appeals.length; j++) {
            const a1 = event.appeals[i]
            const a2 = event.appeals[j]

            if (this.areTimecodesOverlapping(a1.timecodes, a2.timecodes)) {
              const key1 = `${athlete.id}|${event.event}|${a1.related_segment || 'general'}`
              const key2 = `${athlete.id}|${event.event}|${a2.related_segment || 'general'}`

              if (key1 === key2 || (a1.related_segment === a2.related_segment && a1.related_segment != null)) {
                const existing = duplicates.find(d => 
                  (d.duplicateAppealId === a1.appeal_id || d.duplicateAppealId === a2.appeal_id)
                )
                if (!existing && !a1.is_duplicate && !a2.is_duplicate) {
                  duplicates.push({
                    type: 'potential_duplicate',
                    severity: 'low',
                    athleteId: athlete.id,
                    athleteName: athlete.name,
                    event: event.event,
                    appeal1: {
                      id: a1.appeal_id,
                      submitter: a1.submitter,
                      submitTime: a1.submit_time,
                      timecodes: a1.timecodes
                    },
                    appeal2: {
                      id: a2.appeal_id,
                      submitter: a2.submitter,
                      submitTime: a2.submit_time,
                      timecodes: a2.timecodes
                    },
                    description: '潜在重复申诉：时间码重叠且针对同一段动作',
                    relatedSegment: a1.related_segment || 'general'
                  })
                }
              }
            }
          }
        }
      }
    }

    return {
      duplicates,
      count: duplicates.length
    }
  }

  areTimecodesOverlapping(tc1, tc2) {
    if (!tc1 || !tc2) return false

    const start1 = this.timeToSeconds(tc1.start)
    const end1 = this.timeToSeconds(tc1.end)
    const start2 = this.timeToSeconds(tc2.start)
    const end2 = this.timeToSeconds(tc2.end)

    return (start1 <= end2 && end1 >= start2)
  }

  timeToSeconds(timeStr) {
    if (!timeStr) return 0
    const parts = timeStr.split(':')
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1])
    }
    return parseInt(timeStr) || 0
  }

  analyzeRankingImpact() {
    const athletes = [...this.alignedData.athletes]
    
    const potentialChanges = []

    for (let i = 0; i < athletes.length; i++) {
      for (let j = i + 1; j < athletes.length; j++) {
        const a = athletes[i]
        const b = athletes[j]
        
        const scoreDiff = Math.abs(a.totalScore - b.totalScore)
        
        if (scoreDiff < 0.5) {
          potentialChanges.push({
            type: 'rank_risk',
            severity: scoreDiff < 0.2 ? 'high' : 'medium',
            description: `${a.name} (第${a.rank}名) 与 ${b.name} (第${b.rank}名) 分差较小`,
            athletes: [
              { id: a.id, name: a.name, rank: a.rank, score: a.totalScore, team: a.team },
              { id: b.id, name: b.name, rank: b.rank, score: b.totalScore, team: b.team }
            ],
            scoreDifference: scoreDiff.toFixed(2),
            note: '如申诉成功可能影响排名'
          })
        }
      }
    }

    const appealImpact = []
    const appealAnalysis = this.analysisResults?.appealAnalysis || {}
    
    if (appealAnalysis.hitAppeals) {
      for (const appeal of appealAnalysis.hitAppeals) {
        const athlete = athletes.find(a => a.id === appeal.athleteId)
        if (!athlete) continue

        let potentialGain = 0
        if (appeal.relatedIssues) {
          for (const issue of appeal.relatedIssues) {
            if (issue.type === 'difficulty_diff' && issue.details) {
              const maxScore = issue.details.max
              const avgScore = issue.details.judges.reduce((s, j) => s + j.score, 0) / issue.details.judges.length
              potentialGain += (maxScore - avgScore)
            }
          }
        }

        if (potentialGain > 0) {
          const newPotentialScore = athlete.totalScore + potentialGain
          
          const athletesAbove = athletes.filter(a => 
            a.totalScore > athlete.totalScore && a.totalScore <= newPotentialScore
          )

          if (athletesAbove.length > 0) {
            appealImpact.push({
              athleteId: athlete.id,
              athleteName: athlete.name,
              currentRank: athlete.rank,
              currentScore: athlete.totalScore,
              potentialGain: potentialGain.toFixed(2),
              potentialScore: newPotentialScore.toFixed(2),
              potentialOvertake: athletesAbove.map(a => ({
                id: a.id,
                name: a.name,
                rank: a.rank,
                score: a.totalScore
              })),
              relatedAppeal: {
                id: appeal.appeal_id,
                event: appeal.event,
                complaint: appeal.complaint
              }
            })
          }
        }
      }
    }

    return {
      currentRanking: athletes.map(a => ({
        rank: a.rank,
        athleteId: a.id,
        name: a.name,
        team: a.team,
        totalScore: a.totalScore.toFixed(2)
      })),
      rankRisks: potentialChanges,
      appealImpact
    }
  }

  getSeverity(difference, threshold) {
    if (difference >= threshold * 2) return 'high'
    if (difference >= threshold) return 'medium'
    return 'low'
  }

  generateSummary({ scoreDifferences, difficultyIssues, appealAnalysis, duplicateAppeals }) {
    const highPriorityIssues = [
      ...(scoreDifferences.issues?.filter(i => i.severity === 'high') || []),
      ...(difficultyIssues.issues?.filter(i => i.severity === 'high') || [])
    ]

    const totalAppeals = appealAnalysis?.total || 0
    const hitAppeals = appealAnalysis?.hitAppeals?.length || 0
    const duplicateCount = duplicateAppeals?.count || 0

    return {
      totalIssues: highPriorityIssues.length + (difficultyIssues.count || 0),
      highPriorityCount: highPriorityIssues.length,
      totalAppeals,
      hitAppeals,
      pendingAppeals: totalAppeals - hitAppeals,
      duplicateAppeals: duplicateCount,
      riskLevel: this.calculateRiskLevel(highPriorityIssues.length, hitAppeals, duplicateCount)
    }
  }

  calculateRiskLevel(highIssues, hitAppeals, duplicates) {
    let score = 0
    score += highIssues * 3
    score += hitAppeals * 2
    score += duplicates * 1

    if (score >= 5) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }

  getAnalysisResults() {
    return this.analysisResults
  }
}

export default AnalyticsEngine
