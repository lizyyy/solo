import React from 'react'

function Statistics({ statistics, conflicts }) {
  if (!statistics) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">暂无统计数据，请先运行冲突检测</div>
        </div>
      </div>
    )
  }

  const typeLabels = {
    TIME_CONFLICT: '时间冲突',
    CREDIT_OVERLOAD: '学分超量',
    CREDIT_UNDERLOAD: '学分不足',
    DUPLICATE_SELECTION: '重复选课',
    COURSE_CAPACITY_EXCEEDED: '容量超限',
    COURSE_RATIO_HIGH: '选课率预警',
    DAILY_LIMIT_EXCEEDED: '单日超限'
  }

  const statCards = [
    { 
      label: '总冲突数', 
      value: statistics.totalConflicts,
      color1: '#667eea',
      color2: '#764ba2'
    },
    { 
      label: '高危冲突', 
      value: statistics.bySeverity.high,
      color1: '#ef4444',
      color2: '#dc2626'
    },
    { 
      label: '中危冲突', 
      value: statistics.bySeverity.medium,
      color1: '#f59e0b',
      color2: '#d97706'
    },
    { 
      label: '低危冲突', 
      value: statistics.bySeverity.low,
      color1: '#3b82f6',
      color2: '#2563eb'
    }
  ]

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: '20px' }}>
        {statCards.map((card, idx) => (
          <div 
            key={idx} 
            className="stat-card"
            style={{ 
              '--color1': card.color1, 
              '--color2': card.color2 
            }}
          >
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 className="card-title">冲突类型分布</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {Object.entries(statistics.byType || {}).map(([type, count]) => {
              const percentage = ((count / statistics.totalConflicts) * 100).toFixed(1)
              return (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '13px'
                  }}>
                    <span>{typeLabels[type] || type}</span>
                    <span>{count} ({percentage}%)</span>
                  </div>
                  <div style={{ 
                    height: '8px', 
                    background: '#e2e8f0', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div 
                      style={{ 
                        height: '100%',
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, #667eea, #764ba2)',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">学生冲突排行</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {Object.entries(statistics.byStudent || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([studentId, count], idx) => (
                <div 
                  key={studentId} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%',
                      background: idx < 3 ? '#fef3c7' : '#f1f5f9',
                      color: idx < 3 ? '#d97706' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: '500' }}>{studentId}</span>
                  </div>
                  <span className={`badge ${count >= 3 ? 'badge-danger' : count >= 2 ? 'badge-warning' : 'badge-info'}`}>
                    {count} 个冲突
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">冲突明细统计表</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>冲突类型</th>
                <th>严重程度</th>
                <th>学生/课程</th>
                <th>原因</th>
                <th>数值</th>
                <th>阈值</th>
                <th>规则来源</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map(conflict => (
                <tr key={conflict.id}>
                  <td>
                    <span className="badge badge-info">
                      {typeLabels[conflict.type] || conflict.type}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      conflict.severity === 'high' ? 'badge-danger' :
                      conflict.severity === 'medium' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {conflict.severity === 'high' ? '高危' : 
                       conflict.severity === 'medium' ? '中危' : '低危'}
                    </span>
                  </td>
                  <td>{conflict.studentId || conflict.courseName || '-'}</td>
                  <td style={{ maxWidth: '300px', fontSize: '13px' }}>{conflict.reason}</td>
                  <td>
                    {conflict.unit === '%' 
                      ? (conflict.value * 100).toFixed(1) + '%' 
                      : conflict.value + ' ' + conflict.unit}
                  </td>
                  <td>
                    {conflict.unit === '%' 
                      ? (conflict.threshold * 100).toFixed(0) + '%' 
                      : conflict.threshold + ' ' + conflict.unit}
                  </td>
                  <td style={{ fontSize: '12px', color: '#888' }}>{conflict.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Statistics
