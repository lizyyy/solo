import React, { useState, useEffect } from 'react'
import ConflictItem from './ConflictItem'

function ConflictList({ conflicts, loading }) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  const toggleExpand = (id) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  const sortedConflicts = [...conflicts].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  if (loading) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">正在分析冲突...</div>
        </div>
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-text">暂无冲突数据，请先运行冲突检测</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="card-title">
        冲突检测结果 ({conflicts.length})
      </h2>
      
      {sortedConflicts.map(conflict => (
        <ConflictItem 
          key={conflict.id}
          conflict={conflict}
          expanded={expandedIds.has(conflict.id)}
          onToggle={() => toggleExpand(conflict.id)}
        />
      ))}
    </div>
  )
}

export default ConflictList
