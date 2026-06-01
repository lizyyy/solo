import React, { useState, useEffect } from 'react'
import NoteSection from './NoteSection'

function ConflictItem({ conflict, expanded, onToggle }) {
  const severityLabels = {
    high: { text: '高危', class: 'badge-danger' },
    medium: { text: '中危', class: 'badge-warning' },
    low: { text: '低危', class: 'badge-info' }
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

  return (
    <div className={`conflict-item ${conflict.severity}`}>
      <div className="conflict-header">
        <div>
          <span className="conflict-title">
            {conflict.title}
          </span>
          <span className={`badge ${severityLabels[conflict.severity].class}`} 
                style={{ marginLeft: '8px' }}>
            {severityLabels[conflict.severity].text}
          </span>
          <span className="badge badge-info" style={{ marginLeft: '8px' }}>
            {typeLabels[conflict.type] || conflict.type}
          </span>
        </div>
        <button 
          className="btn btn-secondary"
          style={{ padding: '4px 12px', fontSize: '12px' }}
          onClick={onToggle}
        >
          {expanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      <div className="conflict-reason">
        {conflict.reason}
      </div>

      {conflict.studentId && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
          <strong>学生ID:</strong> {conflict.studentId}
        </div>
      )}

      {conflict.affectedCourses && conflict.affectedCourses.length > 0 && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
          <strong>涉及课程:</strong> {conflict.affectedCourses.join(', ')}
        </div>
      )}

      {expanded && (
        <>
          <div className="conflict-formula">
            <div style={{ marginBottom: '4px', fontWeight: '500' }}>📐 判定公式</div>
            <div>{conflict.formula}</div>
            {conflict.formulaDetail && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                规则说明: {conflict.formulaDetail}
              </div>
            )}
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            marginTop: '12px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '8px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>实际值</div>
              <div style={{ fontWeight: '600', fontSize: '18px' }}>
                {conflict.unit === '%' 
                  ? (conflict.value * 100).toFixed(1) + '%' 
                  : conflict.value + ' ' + conflict.unit}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>阈值</div>
              <div style={{ fontWeight: '600', fontSize: '18px' }}>
                {conflict.unit === '%' 
                  ? (conflict.threshold * 100).toFixed(0) + '%' 
                  : conflict.threshold + ' ' + conflict.unit}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888' }}>偏差</div>
              <div style={{ fontWeight: '600', fontSize: '18px', color: '#dc2626' }}>
                {conflict.unit === '%'
                  ? ((conflict.value - conflict.threshold) * 100).toFixed(1) + '%'
                  : (conflict.value - conflict.threshold) + ' ' + conflict.unit}
              </div>
            </div>
          </div>

          {conflict.overlapDetails && conflict.overlapDetails.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                📅 冲突时段详情
              </div>
              {conflict.overlapDetails.map((detail, idx) => (
                <div key={idx} style={{ 
                  fontSize: '12px', 
                  padding: '8px', 
                  background: '#fef2f2', 
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  {detail.day}: {detail.slot1} 与 {detail.slot2} 重叠 {detail.overlapMinutes} 分钟
                </div>
              ))}
            </div>
          )}

          <div className="conflict-source">
            📌 规则来源: {conflict.source} | 检测步骤: #{conflict.traceId}
          </div>

          <NoteSection recordId={conflict.id} />
        </>
      )}
    </div>
  )
}

export default ConflictItem
