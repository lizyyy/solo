import React, { useState } from 'react'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

type Segment = 'threshold_source' | 'nameplate_supplement' | 'manual_confirmation'

const SEGMENT_LABELS: Record<Segment, string> = {
  threshold_source: '📋 安全阈值表来源',
  nameplate_supplement: '🔧 设备铭牌参数补录',
  manual_confirmation: '✋ 人工确认',
}

const SEGMENT_DESCS: Record<Segment, string> = {
  threshold_source: '安全阈值表的导入、版本和来源追溯',
  nameplate_supplement: '设备铭牌参数补录、冲突发现和重算记录',
  manual_confirmation: '维修师傅和质检员的人工确认与复核操作',
}

export function AuditTrailPanel({ state }: Props) {
  const { auditTrail, getAuditBySegment } = state
  const [activeSegment, setActiveSegment] = useState<Segment>('threshold_source')

  const segmentEntries = getAuditBySegment(activeSegment)

  const allSegments: Segment[] = ['threshold_source', 'nameplate_supplement', 'manual_confirmation']
  const counts = allSegments.reduce((acc, seg) => {
    acc[seg] = getAuditBySegment(seg).length
    return acc
  }, {} as Record<Segment, number>)

  return (
    <>
      <div className="page-header">
        <h2>追溯审计</h2>
        <p>质检员第二天复查时可按安全阈值表来源、设备铭牌参数补录、人工确认三段追溯，不用重新翻聊天记录</p>
      </div>

      <div className="segment-tabs">
        {allSegments.map(seg => (
          <button
            key={seg}
            className={`segment-tab ${activeSegment === seg ? 'active' : ''}`}
            onClick={() => setActiveSegment(seg)}
          >
            {SEGMENT_LABELS[seg]} ({counts[seg]})
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{SEGMENT_LABELS[activeSegment]}</h3>
          <div className="meta">{SEGMENT_DESCS[activeSegment]}</div>
        </div>

        {segmentEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>此段暂无审计记录</p>
          </div>
        ) : (
          <div className="audit-timeline">
            {segmentEntries.map(entry => (
              <div key={entry.id} className="audit-entry">
                <div className="audit-action">{entry.action}</div>
                <div className="audit-meta">
                  操作人：{entry.operator || '待定'} | 时间：{entry.timestamp ? new Date(entry.timestamp).toLocaleString('zh-CN') : '待定'}
                  {entry.parameterVersion && (
                    <span className="param-version-tag" style={{ marginLeft: 8 }}>{entry.parameterVersion}</span>
                  )}
                </div>
                <div className="audit-details">{entry.details}</div>
                {entry.relatedRecordId && (
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    关联记录：{entry.relatedRecordId}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>全量审计时间线</h3>
          <div className="meta">按时间倒序，跨三段综合查看</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>分段</th>
              <th>操作</th>
              <th>操作人</th>
              <th>详情</th>
              <th>参数版本</th>
            </tr>
          </thead>
          <tbody>
            {[...auditTrail]
              .filter(a => a.timestamp)
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map(entry => (
                <tr key={entry.id}>
                  <td style={{ fontSize: 12 }}>{new Date(entry.timestamp).toLocaleString('zh-CN')}</td>
                  <td>
                    <span className={`status-badge ${entry.segment === 'threshold_source' ? 'safe' : entry.segment === 'nameplate_supplement' ? 'warning' : 'pending'}`}>
                      {SEGMENT_LABELS[entry.segment]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{entry.action}</td>
                  <td>{entry.operator}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8', maxWidth: 280 }}>{entry.details}</td>
                  <td>{entry.parameterVersion && <span className="param-version-tag">{entry.parameterVersion}</span>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>追溯指南</h3>
          <div className="meta">质检员复查时的操作指引</div>
        </div>
        <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 2 }}>
          <div>
            <strong style={{ color: '#6ee7b7' }}>第一段 · 安全阈值表来源</strong>
            <br />
            查看安全阈值表的导入时间、版本号和来源文件。确认所使用的阈值是否为最新版本，是否经过审批。
          </div>
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: '#fbbf24' }}>第二段 · 设备铭牌参数补录</strong>
            <br />
            查看设备铭牌参数的补录时间、补录人和参数版本。确认补录后是否发现冲突，冲突如何处理，是否已重算挠度预警结果。
          </div>
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: '#93c5fd' }}>第三段 · 人工确认</strong>
            <br />
            查看维修师傅对冲突的确认/驳回记录、质检员对缺失数据的复核记录。确认所有人工决策是否留有理由备注。
          </div>
        </div>
      </div>
    </>
  )
}
