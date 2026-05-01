import React from 'react'
import { GradeRating } from '../utils/ScoreCalculator'
import './ScorePanel.css'

const ScorePanel = ({
  scoreResult,
  onClose,
  onExportJSON,
  onRestart,
  onLoadLevel
}) => {
  if (!scoreResult) {
    return (
      <div className="score-panel-overlay">
        <div className="score-panel">
          <div className="score-no-data">
            <div className="no-data-icon">📊</div>
            <h3>暂无评分数据</h3>
            <p>请完成训练后查看评分</p>
            <button className="btn-primary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  const getGradeIcon = (grade) => {
    switch (grade) {
      case GradeRating.S: return '⭐⭐⭐'
      case GradeRating.A: return '⭐⭐'
      case GradeRating.B: return '⭐'
      case GradeRating.C: return '⚫'
      case GradeRating.D: return '🔴'
      case GradeRating.F: return '❌'
      default: return ''
    }
  }

  const formatPercentage = (value) => {
    return (value * 100).toFixed(1) + '%'
  }

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--'
    return Math.round(minutes) + ' 分钟'
  }

  return (
    <div className="score-panel-overlay">
      <div className="score-panel">
        <div className="score-header">
          <h2 className="score-title">训练评分</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="score-grade-section">
          <div 
            className="grade-display"
            style={{ color: scoreResult.getGradeColor() }}
          >
            <div className="grade-letter">{scoreResult.grade}</div>
            <div className="grade-icon">{getGradeIcon(scoreResult.grade)}</div>
          </div>
          <div className="grade-description">
            {scoreResult.getGradeDescription()}
          </div>
        </div>

        <div className="score-main">
          <div className="score-total">
            <span className="score-label">总分</span>
            <span className="score-value">{scoreResult.totalScore}</span>
            <span className="score-max">/ {scoreResult.maxScore}</span>
          </div>
          <div className="score-bar-container">
            <div className="score-bar">
              <div 
                className="score-fill"
                style={{ 
                  width: `${scoreResult.getPercentage()}%`,
                  background: `linear-gradient(90deg, #4ade80 0%, ${scoreResult.getGradeColor()} 100%)`
                }}
              />
            </div>
            <span className="score-percentage">{scoreResult.getPercentage().toFixed(1)}%</span>
          </div>
        </div>

        <div className="score-stats">
          <h3 className="stats-title">统计数据</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">准点率</div>
              <div className="stat-value">{formatPercentage(scoreResult.onTimeRate)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">冲突次数</div>
              <div className="stat-value danger">{scoreResult.conflictCount}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">严重冲突</div>
              <div className="stat-value danger">{scoreResult.criticalConflictCount}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">拖轮利用率</div>
              <div className="stat-value">{formatPercentage(scoreResult.tugUtilizationRate)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">平均等待时间</div>
              <div className="stat-value">{formatTime(scoreResult.averageWaitTime)}</div>
            </div>
          </div>
        </div>

        <div className="score-breakdown">
          <h3 className="stats-title">评分明细</h3>
          <div className="breakdown-list">
            <div className="breakdown-item">
              <span className="breakdown-label">准点奖励</span>
              <span className="breakdown-value positive">+{scoreResult.scoreBreakdown.onTime}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">拖轮利用奖励</span>
              <span className="breakdown-value positive">+{scoreResult.scoreBreakdown.tugUtilization}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">冲突扣分</span>
              <span className="breakdown-value negative">-{scoreResult.scoreBreakdown.conflictPenalty}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">等待时间扣分</span>
              <span className="breakdown-value negative">-{scoreResult.scoreBreakdown.waitTimePenalty}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">安全违规扣分</span>
              <span className="breakdown-value negative">-{scoreResult.scoreBreakdown.safetyPenalty}</span>
            </div>
          </div>
        </div>

        {scoreResult.keyMistakes && scoreResult.keyMistakes.length > 0 && (
          <div className="score-mistakes">
            <h3 className="stats-title">关键失误</h3>
            <div className="mistakes-list">
              {scoreResult.keyMistakes.map((mistake, index) => (
                <div key={index} className={`mistake-item severity-${mistake.severity}`}>
                  <span className="mistake-icon">
                    {mistake.severity === 'high' ? '🚨' : mistake.severity === 'medium' ? '⚠️' : 'ℹ️'}
                  </span>
                  <span className="mistake-message">{mistake.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="score-actions">
          <button className="btn-secondary" onClick={onExportJSON}>
            📥 导出JSON
          </button>
          <button className="btn-secondary" onClick={onLoadLevel}>
            📂 选择关卡
          </button>
          <button className="btn-primary" onClick={onRestart}>
            🔄 重新开始
          </button>
        </div>
      </div>
    </div>
  )
}

export default ScorePanel
