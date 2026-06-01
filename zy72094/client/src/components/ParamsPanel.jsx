import React, { useState } from 'react'

function ParamsPanel({ params, defaultParams, onSave }) {
  const [localParams, setLocalParams] = useState(params)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  if (!params || !defaultParams) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载参数中...</div>
        </div>
      </div>
    )
  }

  const handleChange = (key, value) => {
    const param = localParams[key]
    const numValue = parseFloat(value)
    
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(param.min, Math.min(param.max, numValue))
      setLocalParams({
        ...localParams,
        [key]: { ...param, value: clampedValue }
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const success = await onSave(localParams)
    if (success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }
    setSaving(false)
  }

  const handleReset = () => {
    if (confirm('确定要恢复所有默认参数吗？')) {
      setLocalParams(defaultParams)
    }
  }

  const paramLabels = {
    maxCreditsPerSemester: '单学期最大学分',
    minCreditsPerSemester: '单学期最小学分',
    maxCoursesPerDay: '单日最大选课门数',
    maxConcurrentEnrollmentRatio: '课程选课率预警阈值',
    timeConflictTolerance: '时间冲突容忍度',
    sameTeacherLimit: '同一课程重复选课次数上限'
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="card-title" style={{ marginBottom: 0 }}>
          参数配置
        </h2>
        <div className="btn-group">
          <button 
            className="btn btn-secondary" 
            onClick={handleReset}
            disabled={saving}
          >
            🔄 恢复默认
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : saveSuccess ? '✓ 已保存' : '💾 保存参数'}
          </button>
        </div>
      </div>

      <div style={{ 
        background: '#eff6ff', 
        padding: '12px 16px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #bfdbfe'
      }}>
        <strong>💡 说明:</strong> 修改后点击保存，下次运行分析时将使用新参数。
        人工调整的参数会被持久化保存，不会被默认值覆盖。
      </div>

      <div className="grid grid-2">
        {Object.entries(localParams).map(([key, param]) => {
          const isDefault = param.value === defaultParams[key]?.value
          
          return (
            <div 
              key={key} 
              className="param-item"
              style={{ 
                border: isDefault ? 'none' : '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '12px 16px',
                background: isDefault ? 'transparent' : '#fefce8'
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="param-name">
                  {paramLabels[key] || key}
                  {!isDefault && (
                    <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                      已修改
                    </span>
                  )}
                </div>
                <div className="param-desc">{param.description}</div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  范围: {param.min} - {param.max} {param.unit} | 默认: {defaultParams[key]?.value} {param.unit}
                </div>
                <div style={{ fontSize: '11px', color: '#667eea', marginTop: '2px' }}>
                  📐 {param.formula}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  📌 来源: {param.source}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="param-value"
                  value={param.value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  min={param.min}
                  max={param.max}
                  step={param.unit === '%' ? 0.01 : 1}
                />
                <span style={{ fontSize: '13px', color: '#666' }}>{param.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ParamsPanel
