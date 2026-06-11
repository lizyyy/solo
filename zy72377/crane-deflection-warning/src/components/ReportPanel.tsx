import React, { useMemo, useState } from 'react'
import type { UnifiedResultRow, BeforeAfterSnapshot } from '../types'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

function formatSnapshotField(field: string, raw: string): string {
  if (field === 'calculationResult') {
    try {
      const obj = JSON.parse(raw)
      return `安全等级=${obj.safetyLevel}, 挠度比=${obj.deflectionRatio}, 版本=${obj.parameterVersion}, 取舍=${obj.tradeOffReason?.slice(0, 20)}...`
    } catch { return raw }
  }
  return raw
}

export function ReportPanel({ state }: Props) {
  const { samplingRecords, getExportData, conflicts, workflowSteps, batches, currentOperator } = state
  const [showAll, setShowAll] = useState(false)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  const exportData = getExportData()
  const missingRecords = exportData.filter(r => r.isMissingHalfHour)
  const abnormalRecords = exportData.filter(r => r.safetyLevel !== 'safe' && !r.isMissingHalfHour)
  const safeRecords = exportData.filter(r => r.safetyLevel === 'safe' && !r.isMissingHalfHour)

  const workflowCompleted = workflowSteps.every(s => s.status === 'completed')
  const allConflictsResolved = conflicts.length > 0 && conflicts.every(c => c.status !== 'pending')

  return (
    <>
      <div className="page-header">
        <h2>结果报告</h2>
        <p>安全阈值表首次导入走到报告时，采样缺失记录的来源、处理状态和结论放在同一份结果里；导出明细含改前/改后内容</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>工作流完成状态</h3>
        </div>
        <div className="workflow-steps">
          {workflowSteps.map(step => (
            <div key={step.step} className={`workflow-step ${step.status}`}>
              <div className="step-num">{step.status === 'completed' ? '✓' : step.step}</div>
              <div style={{ flex: 1 }}>
                <div className="step-label">{step.name}</div>
                {step.completedAt && <div className="step-meta">{step.operator} · {new Date(step.completedAt).toLocaleString('zh-CN')}</div>}
              </div>
            </div>
          ))}
        </div>
        {!workflowCompleted && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
            ⚠️ 工作流未完成，报告可能不完整。请先完成：冲突确认 → 铭牌补看 → 重算
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>采样缺失记录：来源 + 处理状态 + 结论（同一份结果）</h3>
          <div className="meta">采样时间缺了半小时这种记录的来源、处理状态和结论放在同一份结果里</div>
        </div>
        {missingRecords.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">✅</div><p>无缺失记录</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>记录ID</th>
                <th>采样时间</th>
                <th>缺失来源</th>
                <th>缺失时段</th>
                <th>处理状态</th>
                <th>复核人</th>
                <th>复核备注</th>
                <th>结论</th>
                <th>改前改后</th>
              </tr>
            </thead>
            <tbody>
              {missingRecords.map(r => {
                const hasSnapshots = r.beforeAfterSnapshots.length > 0
                const isExpanded = expandedRecord === r.recordId
                return (
                  <React.Fragment key={r.recordId}>
                    <tr style={{ background: '#1c1917' }}>
                      <td>{r.recordId}</td>
                      <td>{new Date(r.samplingTime).toLocaleString('zh-CN')}</td>
                      <td style={{ color: '#fbbf24', fontWeight: 600 }}>{r.missingSource}</td>
                      <td style={{ fontSize: 12 }}>{r.missingPeriod}</td>
                      <td>
                        <span className={`status-badge ${r.reviewStatus === 'reviewed' ? 'safe' : 'pending'}`}>
                          {r.reviewStatus === 'reviewed' ? '已复核' : '待复核'}
                        </span>
                      </td>
                      <td>{r.reviewer || '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.reviewNote || '—'}</td>
                      <td>
                        <span className="status-badge warning">采样缺失，不自动归正常，留质检员复核</span>
                      </td>
                      <td>
                        {hasSnapshots ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setExpandedRecord(isExpanded ? null : r.recordId)}>
                            {isExpanded ? '收起' : `查看${r.beforeAfterSnapshots.length}处变更`}
                          </button>
                        ) : '无变更'}
                      </td>
                    </tr>
                    {isExpanded && hasSnapshots && (
                      <tr>
                        <td colSpan={9} style={{ background: '#0f172a', padding: 12 }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>改前 / 改后 对比：</div>
                          {r.beforeAfterSnapshots.map((snap, i) => (
                            <div key={i} style={{ marginBottom: 6, fontSize: 12 }}>
                              <span style={{ color: '#93c5fd' }}>[{snap.field}]</span>
                              <span style={{ color: '#fca5a5', marginLeft: 8 }}>改前: {formatSnapshotField(snap.field, snap.before)}</span>
                              <span style={{ color: '#6ee7b7', marginLeft: 8 }}>→ 改后: {formatSnapshotField(snap.field, snap.after)}</span>
                              <span style={{ color: '#64748b', marginLeft: 8 }}>({snap.changedBy}, {new Date(snap.changedAt).toLocaleString('zh-CN')})</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>全量结果明细</h3>
          <div className="flex-gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? '仅显示异常/缺失' : '显示全部'}
            </button>
            <span className="meta">共{exportData.length}条 | 安全{safeRecords.length} | 异常{abnormalRecords.length} | 缺失{missingRecords.length}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>记录ID</th>
              <th>采样时间</th>
              <th>挠度值</th>
              <th>缺失</th>
              <th>状态</th>
              <th>安全等级</th>
              <th>挠度比</th>
              <th>参数版本</th>
              <th>取舍理由</th>
              <th>冲突处理</th>
              <th>改前改后</th>
            </tr>
          </thead>
          <tbody>
            {(showAll ? exportData : [...missingRecords, ...abnormalRecords]).map(r => {
              const hasSnapshots = r.beforeAfterSnapshots.length > 0
              const isExpanded = expandedRecord === r.recordId
              return (
                <React.Fragment key={r.recordId}>
                  <tr>
                    <td>{r.recordId}</td>
                    <td style={{ fontSize: 12 }}>{new Date(r.samplingTime).toLocaleString('zh-CN')}</td>
                    <td>{r.isMissingHalfHour ? '—' : `${r.deflectionValue} ${r.unit}`}</td>
                    <td>{r.isMissingHalfHour && <span className="missing-marker">缺失30min</span>}</td>
                    <td><span className={`status-badge ${r.status}`}>{r.status === 'normal' ? '正常' : r.status === 'abnormal' ? '异常' : '待复核'}</span></td>
                    <td>{r.safetyLevel && <span className={`status-badge ${r.safetyLevel}`}>{r.safetyLevel === 'safe' ? '安全' : r.safetyLevel === 'warning' ? '预警' : '危险'}</span>}</td>
                    <td>{r.deflectionRatio || '—'}</td>
                    <td>{r.parameterVersion && <span className="param-version-tag">{r.parameterVersion}</span>}</td>
                    <td>{r.tradeOffReason && <span className="tradeoff-reason">{r.tradeOffReason}</span>}</td>
                    <td style={{ fontSize: 11, color: '#94a3b8', maxWidth: 120 }}>{r.conflictResolution?.slice(0, 30)}...</td>
                    <td>
                      {hasSnapshots ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedRecord(isExpanded ? null : r.recordId)}>
                          {isExpanded ? '收起' : `${r.beforeAfterSnapshots.length}处`}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                  {isExpanded && hasSnapshots && (
                    <tr>
                      <td colSpan={11} style={{ background: '#0f172a', padding: 12 }}>
                        {r.beforeAfterSnapshots.map((snap, i) => (
                          <div key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                            <span style={{ color: '#93c5fd' }}>[{snap.field}]</span>
                            <span style={{ color: '#fca5a5', marginLeft: 8 }}>改前: {formatSnapshotField(snap.field, snap.before)}</span>
                            <span style={{ color: '#6ee7b7', marginLeft: 8 }}>→ 改后: {formatSnapshotField(snap.field, snap.after)}</span>
                            <span style={{ color: '#64748b', marginLeft: 8 }}>({snap.changedBy})</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>导出明细（改前/改后反查）</h3>
          <div className="meta">补录后能从导出明细反查改前内容、改后内容和状态变化</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>记录ID</th>
              <th>变更字段</th>
              <th>改前内容</th>
              <th>改后内容</th>
              <th>变更时间</th>
              <th>变更人</th>
            </tr>
          </thead>
          <tbody>
            {exportData.flatMap(r => r.beforeAfterSnapshots.map(snap => ({ ...snap, recordId: r.recordId }))).map((row, i) => (
              <tr key={i}>
                <td>{row.recordId}</td>
                <td style={{ fontWeight: 600, color: '#93c5fd' }}>{row.field}</td>
                <td style={{ fontSize: 12, color: '#fca5a5', maxWidth: 200, wordBreak: 'break-all' }}>{formatSnapshotField(row.field, row.before)}</td>
                <td style={{ fontSize: 12, color: '#6ee7b7', maxWidth: 200, wordBreak: 'break-all' }}>{formatSnapshotField(row.field, row.after)}</td>
                <td style={{ fontSize: 12 }}>{new Date(row.changedAt).toLocaleString('zh-CN')}</td>
                <td>{row.changedBy}</td>
              </tr>
            ))}
            {exportData.flatMap(r => r.beforeAfterSnapshots).length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>暂无变更记录（执行补录后重算后会在此处生成）</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
