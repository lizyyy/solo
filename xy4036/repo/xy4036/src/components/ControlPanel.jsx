import React from 'react'
import { SimulationSpeed } from '../engine/Simulator'
import './ControlPanel.css'

const ControlPanel = ({
  currentTime,
  maxTime,
  simulationSpeed,
  isRunning,
  canUndo,
  canRedo,
  onPlayPause,
  onSpeedChange,
  onUndo,
  onRedo,
  onRestart,
  onSave,
  onLoad,
  onShowScore
}) => {
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const progress = maxTime > 0 ? (currentTime / maxTime) * 100 : 0

  const speedOptions = [
    { value: SimulationSpeed.PAUSED, label: '暂停' },
    { value: SimulationSpeed.NORMAL, label: '1x' },
    { value: SimulationSpeed.FAST, label: '2x' },
    { value: SimulationSpeed.VERY_FAST, label: '5x' },
    { value: SimulationSpeed.TURBO, label: '10x' }
  ]

  return (
    <div className="control-panel">
      <div className="control-section">
        <div className="time-display">
          <span className="time-label">当前时间</span>
          <span className="time-value">{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="time-value">{formatTime(maxTime)}</span>
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="control-section">
        <div className="speed-controls">
          <span className="speed-label">速度:</span>
          <div className="speed-buttons">
            {speedOptions.map((option) => (
              <button
                key={option.value}
                className={`speed-btn ${simulationSpeed === option.value ? 'active' : ''}`}
                onClick={() => onSpeedChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="control-section">
        <div className="action-buttons">
          <button
            className="action-btn play-pause"
            onClick={onPlayPause}
            title={isRunning ? '暂停' : '开始'}
          >
            {isRunning ? '⏸ 暂停' : '▶ 开始'}
          </button>
          
          <button
            className={`action-btn undo ${!canUndo ? 'disabled' : ''}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
          >
            ↩ 撤销
          </button>
          
          <button
            className={`action-btn redo ${!canRedo ? 'disabled' : ''}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="重做 (Ctrl+Y)"
          >
            ↪ 重做
          </button>
        </div>
      </div>

      <div className="control-section">
        <div className="utility-buttons">
          <button
            className="utility-btn restart"
            onClick={onRestart}
            title="重新开始"
          >
            🔄 重新开始
          </button>
          
          <button
            className="utility-btn save"
            onClick={onSave}
            title="保存进度"
          >
            💾 保存
          </button>
          
          <button
            className="utility-btn load"
            onClick={onLoad}
            title="加载进度"
          >
            📂 加载
          </button>
          
          <button
            className="utility-btn score"
            onClick={onShowScore}
            title="查看评分"
          >
            📊 评分
          </button>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel
