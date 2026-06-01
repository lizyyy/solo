import React from 'react'

function FilterBar({ filterOptions, setFilterOptions, conflicts }) {
  const conflictTypes = [...new Set(conflicts.map(c => c.type))]
  const studentIds = [...new Set(conflicts.filter(c => c.studentId).map(c => c.studentId))]
  const severities = ['high', 'medium', 'low']

  const typeLabels = {
    TIME_CONFLICT: '时间冲突',
    CREDIT_OVERLOAD: '学分超量',
    CREDIT_UNDERLOAD: '学分不足',
    DUPLICATE_SELECTION: '重复选课',
    COURSE_CAPACITY_EXCEEDED: '容量超限',
    COURSE_RATIO_HIGH: '选课率预警',
    DAILY_LIMIT_EXCEEDED: '单日超限'
  }

  const severityLabels = {
    high: '高危',
    medium: '中危',
    low: '低危'
  }

  const handleChange = (key, value) => {
    setFilterOptions({
      ...filterOptions,
      [key]: value === '' ? undefined : value
    })
  }

  const clearFilters = () => {
    setFilterOptions({})
  }

  const hasFilters = Object.values(filterOptions).some(v => v !== undefined)

  return (
    <div className="filter-bar">
      <div className="filter-item">
        <span className="filter-label">🔍 筛选:</span>
      </div>

      <div className="filter-item">
        <span className="filter-label">学生ID:</span>
        <select 
          className="filter-select"
          value={filterOptions.studentId || ''}
          onChange={(e) => handleChange('studentId', e.target.value)}
        >
          <option value="">全部学生</option>
          {studentIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      <div className="filter-item">
        <span className="filter-label">冲突类型:</span>
        <select 
          className="filter-select"
          value={filterOptions.conflictType || ''}
          onChange={(e) => handleChange('conflictType', e.target.value)}
        >
          <option value="">全部类型</option>
          {conflictTypes.map(type => (
            <option key={type} value={type}>{typeLabels[type] || type}</option>
          ))}
        </select>
      </div>

      <div className="filter-item">
        <span className="filter-label">严重程度:</span>
        <select 
          className="filter-select"
          value={filterOptions.severity || ''}
          onChange={(e) => handleChange('severity', e.target.value)}
        >
          <option value="">全部程度</option>
          {severities.map(s => (
            <option key={s} value={s}>{severityLabels[s]}</option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button 
          className="btn btn-secondary"
          onClick={clearFilters}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          ✕ 清除筛选
        </button>
      )}

      <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
        当前显示 {conflicts.length} 条结果
        {hasFilters && <span className="diff-highlight" style={{ marginLeft: '8px' }}>（已筛选）</span>}
      </div>
    </div>
  )
}

export default FilterBar
