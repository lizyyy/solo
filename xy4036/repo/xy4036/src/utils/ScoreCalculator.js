import { ShipStatus, ShipTypes } from '../models/Ship'
import { ConflictSeverity } from '../engine/RulesEngine'

export const GradeRating = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F'
}

export class ScoreResult {
  constructor(params = {}) {
    this.totalScore = params.totalScore || 0
    this.maxScore = params.maxScore || 1000
    
    this.onTimeRate = params.onTimeRate || 0
    this.conflictCount = params.conflictCount || 0
    this.criticalConflictCount = params.criticalConflictCount || 0
    this.tugUtilizationRate = params.tugUtilizationRate || 0
    this.averageWaitTime = params.averageWaitTime || 0
    this.keyMistakes = params.keyMistakes || []
    
    this.scoreBreakdown = params.scoreBreakdown || {
      onTime: 0,
      tugUtilization: 0,
      conflictPenalty: 0,
      waitTimePenalty: 0,
      safetyPenalty: 0
    }
    
    this.grade = params.grade || GradeRating.F
  }

  static fromJSON(json) {
    return new ScoreResult(json)
  }

  toJSON() {
    return {
      totalScore: this.totalScore,
      maxScore: this.maxScore,
      onTimeRate: this.onTimeRate,
      conflictCount: this.conflictCount,
      criticalConflictCount: this.criticalConflictCount,
      tugUtilizationRate: this.tugUtilizationRate,
      averageWaitTime: this.averageWaitTime,
      keyMistakes: [...this.keyMistakes],
      scoreBreakdown: { ...this.scoreBreakdown },
      grade: this.grade
    }
  }

  getPercentage() {
    return (this.totalScore / this.maxScore) * 100
  }

  getGradeName() {
    return this.grade
  }

  getGradeColor() {
    const colors = {
      [GradeRating.S]: '#FFD700',
      [GradeRating.A]: '#4CAF50',
      [GradeRating.B]: '#2196F3',
      [GradeRating.C]: '#FF9800',
      [GradeRating.D]: '#FF5722',
      [GradeRating.F]: '#F44336'
    }
    return colors[this.grade] || colors[GradeRating.F]
  }

  getGradeDescription() {
    const descriptions = {
      [GradeRating.S]: '卓越 - 调度完美，无任何失误',
      [GradeRating.A]: '优秀 - 调度合理，仅少数小问题',
      [GradeRating.B]: '良好 - 整体调度正确，存在一些可改进之处',
      [GradeRating.C]: '合格 - 基本完成任务，但存在较多问题',
      [GradeRating.D]: '待改进 - 存在较多失误，需要加强训练',
      [GradeRating.F]: '不合格 - 存在严重安全问题或大量延误'
    }
    return descriptions[this.grade] || descriptions[GradeRating.F]
  }
}

export class ScoreCalculator {
  constructor(level, rulesEngine) {
    this.level = level
    this.rulesEngine = rulesEngine
    this.scoringRules = level.scoringRules || {
      onTimeBonus: 100,
      delayPenalty: 50,
      conflictPenalty: 200,
      tugUtilizationBonus: 50,
      safetyViolationPenalty: 500
    }
  }

  calculate(currentTime) {
    const allShips = this.level.getAllVessels()
    const completedShips = allShips.filter(s => s.status === ShipStatus.COMPLETED)
    const totalShips = allShips.length
    
    const onTimeShips = completedShips.filter(s => {
      if (s.isEntry && s.actualArrivalTime && s.deadlineTime) {
        return s.actualArrivalTime <= s.deadlineTime
      }
      if (s.isDeparture && s.actualDepartureTime && s.deadlineTime) {
        return s.actualDepartureTime <= s.deadlineTime
      }
      return true
    })

    const onTimeRate = completedShips.length > 0 ? onTimeShips.length / completedShips.length : 0
    const averageWaitTime = this.calculateAverageWaitTime(allShips)
    
    const conflicts = this.rulesEngine.conflicts
    const conflictCount = conflicts.length
    const criticalConflictCount = conflicts.filter(c => c.severity === ConflictSeverity.CRITICAL).length
    
    const tugUtilizationRate = this.calculateTugUtilization(allShips, currentTime)
    const keyMistakes = this.identifyKeyMistakes(allShips, conflicts, currentTime)
    
    let score = 500
    const scoreBreakdown = {
      onTime: 0,
      tugUtilization: 0,
      conflictPenalty: 0,
      waitTimePenalty: 0,
      safetyPenalty: 0
    }

    scoreBreakdown.onTime = Math.round(onTimeRate * this.scoringRules.onTimeBonus * completedShips.length)
    score += scoreBreakdown.onTime

    scoreBreakdown.tugUtilization = Math.round(tugUtilizationRate * this.scoringRules.tugUtilizationBonus * this.level.tugs.length)
    score += scoreBreakdown.tugUtilization

    scoreBreakdown.conflictPenalty = conflictCount * this.scoringRules.conflictPenalty
    score -= scoreBreakdown.conflictPenalty

    scoreBreakdown.waitTimePenalty = Math.round(averageWaitTime * 0.1)
    score -= scoreBreakdown.waitTimePenalty

    scoreBreakdown.safetyPenalty = criticalConflictCount * this.scoringRules.safetyViolationPenalty
    score -= scoreBreakdown.safetyPenalty

    score = Math.max(0, Math.min(1000, score))

    const grade = this.determineGrade(score, onTimeRate, criticalConflictCount)

    return new ScoreResult({
      totalScore: score,
      maxScore: 1000,
      onTimeRate,
      conflictCount,
      criticalConflictCount,
      tugUtilizationRate,
      averageWaitTime,
      keyMistakes,
      scoreBreakdown,
      grade
    })
  }

  calculateAverageWaitTime(ships) {
    const waitingShips = ships.filter(s => s.waitTime > 0)
    if (waitingShips.length === 0) return 0
    
    const totalWaitTime = waitingShips.reduce((sum, ship) => sum + ship.waitTime, 0)
    return totalWaitTime / waitingShips.length
  }

  calculateTugUtilization(ships, currentTime) {
    const tugs = this.level.tugs
    if (tugs.length === 0) return 0

    const usedTugs = tugs.filter(t => t.status !== 'available' || t.assignedShipId)
    return usedTugs.length / tugs.length
  }

  identifyKeyMistakes(ships, conflicts, currentTime) {
    const mistakes = []

    const overdueShips = ships.filter(s => s.isOverdue(currentTime))
    overdueShips.forEach(ship => {
      mistakes.push({
        type: 'overdue',
        severity: 'high',
        message: `船舶 ${ship.name} 已超时`,
        details: {
          shipId: ship.id,
          deadlineTime: ship.deadlineTime,
          currentTime
        }
      })
    })

    const criticalConflicts = conflicts.filter(c => c.severity === ConflictSeverity.CRITICAL)
    criticalConflicts.forEach(conflict => {
      mistakes.push({
        type: 'critical_conflict',
        severity: 'high',
        message: conflict.message,
        details: conflict.toJSON()
      })
    })

    const waitingShips = ships.filter(s => s.waitTime > 120)
    waitingShips.forEach(ship => {
      mistakes.push({
        type: 'long_wait',
        severity: 'medium',
        message: `船舶 ${ship.name} 等待时间过长 (${Math.round(ship.waitTime)}分钟)`,
        details: {
          shipId: ship.id,
          waitTime: ship.waitTime
        }
      })
    })

    const incompleteShips = ships.filter(s => 
      s.status !== ShipStatus.COMPLETED && 
      s.status !== ShipStatus.WAITING
    )
    incompleteShips.forEach(ship => {
      mistakes.push({
        type: 'incomplete',
        severity: 'medium',
        message: `船舶 ${ship.name} 未完成调度`,
        details: {
          shipId: ship.id,
          currentStatus: ship.status
        }
      })
    })

    return mistakes
  }

  determineGrade(score, onTimeRate, criticalConflictCount) {
    if (criticalConflictCount > 0) {
      if (criticalConflictCount >= 3) return GradeRating.F
      if (criticalConflictCount >= 2) return GradeRating.D
      if (criticalConflictCount >= 1) return GradeRating.C
    }

    if (onTimeRate === 1 && score >= 900) return GradeRating.S
    if (onTimeRate >= 0.8 && score >= 750) return GradeRating.A
    if (onTimeRate >= 0.6 && score >= 600) return GradeRating.B
    if (onTimeRate >= 0.4 && score >= 400) return GradeRating.C
    if (score >= 200) return GradeRating.D

    return GradeRating.F
  }

  exportScoreAsJSON(scoreResult) {
    const exportData = {
      timestamp: Date.now(),
      levelId: this.level.id,
      levelName: this.level.name,
      difficulty: this.level.difficulty,
      score: scoreResult.toJSON(),
      statistics: {
        totalShips: this.level.getTotalVessels(),
        entryVessels: this.level.entryVessels.length,
        departureVessels: this.level.departureVessels.length
      }
    }
    return JSON.stringify(exportData, null, 2)
  }

  downloadScoreJSON(scoreResult) {
    const jsonString = this.exportScoreAsJSON(scoreResult)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `score_${this.level.id}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export default ScoreCalculator
