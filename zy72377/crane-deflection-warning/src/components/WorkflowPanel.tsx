import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

export function WorkflowPanel({ state }: Props) {
  const { workflowSteps, samplingRecords, conflicts, completeWorkflowStep, recalculateAfterSupplement, reviewSamplingRecord, currentOperator } = state

  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const missingRecords = samplingRecords.filter(r => r.isMissingHalfHour && r.reviewStatus === 'pending')

  const chartData = samplingRecords.map(r => ({
    time: new Date(r.timestamp).getHours() + ':' + String(new Date(r.timestamp).getMinutes()).padStart(2, '0'),
    deflection: r.isMissingHalfHour ? null : r.deflectionValue,
    isMissing: r.isMissingHalfHour,
  }))

  const handleReview = (recordId: string) => {
    if (!reviewNote.trim()) return
    reviewSamplingRecord(recordId, reviewNote)
    setReviewingId(null)
    setReviewNote('')
  }

  const canCompleteStep2 = conflicts.every(c => c.status !== 'pending') || conflicts.length === 0
  const step2Completed = workflowSteps.find(s => s.step === 2)?.status === 'completed'
  const step3Completed = workflowSteps.find(s => s.step === 3)?.status === 'completed'

  return (
    <>
      <div className="page-header">
        <h2>工作流管理</h2>
        <p>安全阈值表首次导入 → 维修师傅补看设备铭牌参数 → 实验复盘图更新，中间碰到采样缺失不急着归正常，留给质检员复核</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>三步工作流</h3>
        </div>
        <div className="workflow-steps">
          {workflowSteps.map(step => (
            <div key={step.step} className={`workflow-step ${step.status}`}>
              <div className="step-num">
                {step.status === 'completed' ? '✓' : step.step}
              </div>
              <div style={{ flex: 1 }}>
                <div className="step-label">{step.name}</div>
                {step.completedAt ? (
                  <div className="step-meta">{step.operator} · {new Date(step.completedAt).toLocaleString('zh-CN')}</div>
                ) : step.status === 'in_progress' ? (
                  <div className="step-meta">进行中...</div>
                ) : (
                  <div className="step-meta">等待上一步完成</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {workflowSteps.find(s => s.step === 2)?.status === 'in_progress' && !step2Completed && (
            <button
              className="btn btn-success"
              onClick={() => completeWorkflowStep(2)}
              disabled={!canCompleteStep2}
              title={!canCompleteStep2 ? '请先处理所有冲突' : ''}
            >
              ✓ 完成铭牌参数补看
            </button>
          )}
          {step2Completed && !step3Completed && (
            <button className="btn btn-primary" onClick={() => { recalculateAfterSupplement(); completeWorkflowStep(3) }}>
              🔄 补录后重算 + 更新实验复盘图
            </button>
          )}
          {step3Completed && (
            <span style={{ color: '#6ee7b7', fontSize: 14, fontWeight: 600 }}>✅ 工作流已完成</span>
          )}
        </div>
        {!canCompleteStep2 && conflicts.some(c => c.status === 'pending') && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
            ⚠️ 还有待处理冲突，请先到「冲突检测」页面确认或驳回
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>实验复盘图</h3>
          <div className="meta">
            参数版本:
            <span className="param-version-tag">{step3Completed ? 'v2.1+铭牌v1.0-重算' : 'v2.1'}</span>
          </div>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '危险 150mm', fill: '#fca5a5', fontSize: 11 }} />
              <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '预警 120mm', fill: '#fbbf24', fontSize: 11 }} />
              <Line type="monotone" dataKey="deflection" stroke="#3b82f6" strokeWidth={2} dot={false} name="挠度值(mm)" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          缺失时段以断点显示，不自动归为正常。取舍理由：
          <span className="tradeoff-reason">
            {step3Completed
              ? '补录后重算：采用已确认的阈值作为判定依据（维修师傅老岑确认）'
              : '采用安全阈值表值(150mm)作为判定依据，设备铭牌值(140mm)已记录但未用于判定'}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>⚠️ 待质检员复核的缺失记录</h3>
          <div className="meta">碰到采样时间缺了半小时，不急着归正常，留给质检员复核</div>
        </div>
        {missingRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>无待复核的缺失记录</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>记录ID</th>
                <th>缺失时段</th>
                <th>当前状态</th>
                <th>复核状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {missingRecords.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {r.missingPeriodStart && new Date(r.missingPeriodStart).toLocaleString('zh-CN')}
                    {' ~ '}
                    {r.missingPeriodEnd && new Date(r.missingPeriodEnd).toLocaleString('zh-CN')}
                  </td>
                  <td><span className="status-badge pending_review">待复核</span></td>
                  <td><span className="status-badge pending">等待复核</span></td>
                  <td>
                    {reviewingId === r.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="复核备注（必填）"
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          style={{
                            background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                            padding: '4px 8px', color: '#e2e8f0', fontSize: 12, width: 160
                          }}
                        />
                        <button className="btn btn-success btn-sm" onClick={() => handleReview(r.id)} disabled={!reviewNote.trim()}>
                          提交复核
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setReviewingId(null); setReviewNote('') }}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => setReviewingId(r.id)}>
                        复核
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>已复核记录</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>记录ID</th>
              <th>采样时间</th>
              <th>缺失标记</th>
              <th>状态</th>
              <th>复核人</th>
              <th>复核时间</th>
              <th>复核备注</th>
            </tr>
          </thead>
          <tbody>
            {samplingRecords.filter(r => r.reviewStatus === 'reviewed').map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                <td>{r.isMissingHalfHour && <span className="missing-marker">缺失30min</span>}</td>
                <td><span className={`status-badge ${r.status}`}>{r.status === 'abnormal' ? '异常' : r.status}</span></td>
                <td>{r.reviewer}</td>
                <td>{r.reviewedAt && new Date(r.reviewedAt).toLocaleString('zh-CN')}</td>
                <td style={{ fontSize: 12 }}>{r.reviewNote}</td>
              </tr>
            ))}
            {samplingRecords.filter(r => r.reviewStatus === 'reviewed').length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>暂无</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
