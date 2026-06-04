import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import type { AppState } from '../types'

interface Props {
  state: ReturnType<typeof import('../store/useAppState')['useAppState']>
}

export function DashboardPanel({ state }: Props) {
  const { samplingRecords, conflicts, selfCheckResults, workflowSteps } = state

  const chartData = useMemo(() =>
    samplingRecords.map(r => ({
      time: new Date(r.timestamp).getHours() + ':' + String(new Date(r.timestamp).getMinutes()).padStart(2, '0'),
      deflection: r.isMissingHalfHour ? null : r.deflectionValue,
      isMissing: r.isMissingHalfHour,
      status: r.status,
    })),
    [samplingRecords]
  )

  const totalRecords = samplingRecords.length
  const abnormalRecords = samplingRecords.filter(r => r.status === 'abnormal').length
  const missingRecords = samplingRecords.filter(r => r.isMissingHalfHour).length
  const pendingConflicts = conflicts.filter(c => c.status === 'pending').length

  return (
    <>
      <div className="page-header">
        <h2>预警总览</h2>
        <p>塔吊吊臂挠度实时监测与预警数据概览</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalRecords}</div>
          <div className="stat-label">采样总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: abnormalRecords > 0 ? '#fbbf24' : '#6ee7b7' }}>{abnormalRecords}</div>
          <div className="stat-label">异常记录</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: missingRecords > 0 ? '#fca5a5' : '#6ee7b7' }}>{missingRecords}</div>
          <div className="stat-label">采样缺失</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: pendingConflicts > 0 ? '#fbbf24' : '#6ee7b7' }}>{pendingConflicts}</div>
          <div className="stat-label">待处理冲突</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>挠度趋势图</h3>
          <div className="meta">
            {samplingRecords[0] && `${new Date(samplingRecords[0].timestamp).toLocaleDateString('zh-CN')}`}
            {samplingRecords[samplingRecords.length - 1] && ` ~ ${new Date(samplingRecords[samplingRecords.length - 1].timestamp).toLocaleDateString('zh-CN')}`}
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
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '危险阈值 150mm', fill: '#fca5a5', fontSize: 11 }} />
              <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '预警阈值 120mm', fill: '#fbbf24', fontSize: 11 }} />
              <Line type="monotone" dataKey="deflection" stroke="#3b82f6" strokeWidth={2} dot={false} name="挠度值(mm)" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          ⚠️ 缺失时段以断点显示，未归入正常；参数版本:
          <span className="param-version-tag">v2.1</span>
          阈值取舍:
          <span className="tradeoff-reason">采用安全阈值表值(150mm)作为判定依据</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>工作流进度</h3>
        </div>
        <div className="workflow-steps">
          {workflowSteps.map(step => (
            <div key={step.step} className={`workflow-step ${step.status}`}>
              <div className="step-num">
                {step.status === 'completed' ? '✓' : step.step}
              </div>
              <div>
                <div className="step-label">{step.name}</div>
                {step.completedAt && (
                  <div className="step-meta">{step.operator} · {new Date(step.completedAt).toLocaleString('zh-CN')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>最近采样记录</h3>
          <div className="meta">展示最近10条，缺失半小时记录标红</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>采样时间</th>
              <th>挠度值</th>
              <th>缺失标记</th>
              <th>状态</th>
              <th>安全等级</th>
              <th>参数版本</th>
              <th>取舍理由</th>
            </tr>
          </thead>
          <tbody>
            {samplingRecords.slice(-10).reverse().map(r => (
              <tr key={r.id}>
                <td>{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                <td>{r.isMissingHalfHour ? '—' : `${r.deflectionValue} ${r.unit}`}</td>
                <td>{r.isMissingHalfHour && <span className="missing-marker">缺失30min</span>}</td>
                <td><span className={`status-badge ${r.status}`}>{r.status === 'normal' ? '正常' : r.status === 'abnormal' ? '异常' : '待复核'}</span></td>
                <td>{r.calculationResult && (
                  <span className={`status-badge ${r.calculationResult.safetyLevel}`}>
                    {r.calculationResult.safetyLevel === 'safe' ? '安全' : r.calculationResult.safetyLevel === 'warning' ? '预警' : '危险'}
                  </span>
                )}</td>
                <td>{r.calculationResult && <span className="param-version-tag">{r.calculationResult.parameterVersion}</span>}</td>
                <td>{r.calculationResult && <span className="tradeoff-reason">{r.calculationResult.tradeOffReason}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
