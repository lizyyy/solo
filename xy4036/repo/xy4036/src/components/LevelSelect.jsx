import React from 'react'
import levels from '../data/levels'
import './LevelSelect.css'

const LevelSelect = ({
  onSelectLevel,
  onClose,
  currentLevelId
}) => {

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#4ade80'
      case 'medium': return '#f59e0b'
      case 'hard': return '#ef4444'
      default: return '#94a3b8'
    }
  }

  const getDifficultyLabel = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '入门级'
      case 'medium': return '中级'
      case 'hard': return '困难级'
      default: return '未知'
    }
  }

  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '🌱'
      case 'medium': return '⚔️'
      case 'hard': return '🔥'
      default: return '📋'
    }
  }

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--'
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    if (hours > 0) {
      return `${hours}小时${mins}分钟`
    }
    return `${mins}分钟`
  }

  return (
    <div className="level-select-overlay">
      <div className="level-select-panel">
        <div className="level-select-header">
          <h2 className="level-select-title">选择训练场景</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="level-list">
          {levels.map((level) => (
            <div
              key={level.id}
              className={`level-card ${currentLevelId === level.id ? 'active' : ''}`}
              onClick={() => onSelectLevel(level.id)}
            >
              <div className="level-card-header">
                <div className="level-icon">{getDifficultyIcon(level.difficulty)}</div>
                <div className="level-info">
                  <div className="level-name">{level.name}</div>
                  <div className="level-description">{level.description}</div>
                </div>
                <div 
                  className="level-difficulty"
                  style={{ backgroundColor: getDifficultyColor(level.difficulty) + '20', color: getDifficultyColor(level.difficulty) }}
                >
                  {getDifficultyLabel(level.difficulty)}
                </div>
              </div>
              
              <div className="level-stats">
                <div className="stat">
                  <span className="stat-label">船舶数量</span>
                  <span className="stat-value">{(level.entryVessels?.length || 0) + (level.departureVessels?.length || 0)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">拖轮数量</span>
                  <span className="stat-value">{level.tugs?.length || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">泊位数量</span>
                  <span className="stat-value">{level.berths?.length || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">时长限制</span>
                  <span className="stat-value">{formatTime(level.maxTime)}</span>
                </div>
              </div>
              
              {level.objectives && level.objectives.length > 0 && (
                <div className="level-objectives">
                  <div className="objectives-title">训练目标：</div>
                  <ul className="objectives-list">
                    {level.objectives.map((obj, idx) => (
                      <li key={idx} className="objective-item">
                        <span className="objective-bullet">•</span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {level.specialConditions && level.specialConditions.length > 0 && (
                <div className="level-warnings">
                  <div className="warnings-title">特殊条件：</div>
                  <ul className="warnings-list">
                    {level.specialConditions.map((cond, idx) => (
                      <li key={idx} className="warning-item">
                        <span className="warning-icon">⚠️</span>
                        {cond}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {currentLevelId === level.id && (
                <div className="level-active-indicator">
                  <span className="active-dot"></span>
                  当前训练场景
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="level-select-footer">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

export default LevelSelect
