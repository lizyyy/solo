import React, { useEffect, useRef } from 'react'
import { ConflictSeverity } from '../engine/RulesEngine'
import './EventLog.css'

const EventLog = ({
  events = [],
  conflicts = [],
  maxEntries = 100
}) => {
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, conflicts])

  const allEntries = [
    ...events.map(e => ({ ...e, type: 'event' })),
    ...conflicts.map(c => ({ ...c.toJSON ? c.toJSON() : c, type: 'conflict' }))
  ].sort((a, b) => (a.time || a.timestamp || 0) - (b.time || b.timestamp || 0))
  .slice(-maxEntries)

  const getEntryClass = (entry) => {
    if (entry.type === 'conflict') {
      switch (entry.severity) {
        case ConflictSeverity.CRITICAL:
          return 'log-entry critical'
        case ConflictSeverity.WARNING:
          return 'log-entry warning'
        case ConflictSeverity.INFO:
          return 'log-entry info'
        default:
          return 'log-entry warning'
      }
    }
    
    switch (entry.type) {
      case 'error':
        return 'log-entry critical'
      case 'warning':
        return 'log-entry warning'
      case 'success':
        return 'log-entry success'
      default:
        return 'log-entry info'
    }
  }

  const getEntryIcon = (entry) => {
    if (entry.type === 'conflict') {
      switch (entry.severity) {
        case ConflictSeverity.CRITICAL:
          return '🚨'
        case ConflictSeverity.WARNING:
          return '⚠️'
        case ConflictSeverity.INFO:
          return 'ℹ️'
        default:
          return '⚠️'
      }
    }
    
    switch (entry.type) {
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'success':
        return '✅'
      default:
        return 'ℹ️'
    }
  }

  const formatTime = (time) => {
    if (time === null || time === undefined) return '--:--'
    const hours = Math.floor(time / 60)
    const mins = Math.floor(time % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const getConflictingShipNames = (entry) => {
    if (!entry.shipIds || entry.shipIds.length === 0) return ''
    return entry.shipIds.map(id => {
      // 这里应该从level获取船名，但组件没有level引用
      return id.substring(0, 15)
    }).join(', ')
  }

  return (
    <div className="event-log">
      <div className="log-header">
        <h3 className="log-title">事件日志</h3>
        <span className="log-count">{allEntries.length} 条记录</span>
      </div>
      
      <div className="log-container" ref={logRef}>
        {allEntries.length === 0 ? (
          <div className="log-empty">暂无事件记录</div>
        ) : (
          allEntries.map((entry, index) => (
            <div 
              key={entry.id || `entry_${index}`} 
              className={getEntryClass(entry)}
            >
              <div className="entry-icon">
                {getEntryIcon(entry)}
              </div>
              <div className="entry-content">
                <div className="entry-header">
                  <span className="entry-time">
                    {formatTime(entry.time)}
                  </span>
                  {entry.type === 'conflict' && entry.getTypeName && (
                    <span className="entry-type">
                      {entry.getTypeName()}
                    </span>
                  )}
                </div>
                <div className="entry-message">
                  {entry.message}
                </div>
                {entry.type === 'conflict' && entry.shipIds && entry.shipIds.length > 0 && (
                  <div className="entry-detail">
                    涉及船舶: {getConflictingShipNames(entry)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default EventLog
