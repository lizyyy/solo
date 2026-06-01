import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReviewStore } from '@/store'
import { getPrimaryMeasurements, getEnvironment } from '@/utils/reviewEngine'
import { exportBatchReport } from '@/utils/exporter'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer } from 'recharts'
import type { StringName, ParameterSource } from '@/types'

const STRINGS: StringName[] = ['E弦', 'A弦', 'D弦', 'G弦']
const SOURCES: ParameterSource[] = ['实验表', '照片说明', '工况记录']

const emptyMeas = () => STRINGS.map((s) => ({ stringName: s, standardTension: 0, measuredTension: 0 }))

export default function ReviewWorkbench() {
  const { batchId } = useParams()
  const nav = useNavigate()
  const { batches, currentThreshold, addBatch, addParameterRecord, runAnomalyDetection, runConflictDetection, updateThreshold, setBatchStatus, getBatchById } = useReviewStore()
  const batch = batchId ? getBatchById(batchId) : undefined

  const [activeTab, setActiveTab] = useState<ParameterSource>('实验表')
  const [sourceDesc, setSourceDesc] = useState('')
  const [measForm, setMeasForm] = useState(emptyMeas())
  const [envForm, setEnvForm] = useState({ temperature: 0, humidity: 0, note: '' })
  const [newBatchName, setNewBatchName] = useState('')
  const [showThresholdModal, setShowThresholdModal] = useState(false)
  const [thEdit, setThEdit] = useState<Record<StringName, number>>({ 'E弦': 3, 'A弦': 3, 'D弦': 3, 'G弦': 3 })
  const [thReason, setThReason] = useState('')
  const [judgeReason, setJudgeReason] = useState('')

  const measurements = batch ? getPrimaryMeasurements(batch) : []
  const environment = batch ? getEnvironment(batch) : null
  const threshold = currentThreshold()

  const handleCreate = () => {
    if (!newBatchName.trim()) return
    const b = addBatch(newBatchName.trim())
    setNewBatchName('')
    nav(`/review/${b.id}`)
  }

  const handleImport = () => {
    if (!batch || !sourceDesc.trim()) return
    if (activeTab === '工况记录') {
      addParameterRecord(batch.id, activeTab, sourceDesc, [], envForm)
    } else {
      addParameterRecord(batch.id, activeTab, sourceDesc, measForm.filter((m) => m.standardTension > 0 && m.measuredTension > 0))
    }
    runAnomalyDetection(batch.id)
    runConflictDetection(batch.id)
    setSourceDesc('')
    setMeasForm(emptyMeas())
  }

  const handleThresholdSave = () => {
    if (!thReason.trim()) return
    updateThreshold(thEdit, thReason.trim(), '林老师')
    setShowThresholdModal(false)
    setThReason('')
  }

  const handleJudge = (status: 'passed' | 'anomaly') => {
    if (!batch || !judgeReason.trim()) return
    setBatchStatus(batch.id, status, judgeReason.trim(), '林老师')
    setJudgeReason('')
  }

  if (!batch) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-brand">复核工作台</h1>
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">选择批次</label>
            <select className="input-field w-full" value="" onChange={(e) => nav(`/review/${e.target.value}`)}>
              <option value="" disabled>— 请选择批次 —</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
            </select>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">新建批次名称</label>
              <input className="input-field w-full" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} placeholder="输入批次名称" />
            </div>
            <button className="btn-primary" onClick={handleCreate}>创建</button>
          </div>
        </div>
      </div>
    )
  }

  const chartData = measurements.map((m) => ({
    name: m.stringName,
    deviation: m.deviationRate,
    isAnomaly: m.isAnomaly,
  }))

  return (
    <div className="space-y-6 pb-48">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">{batch.name}</h1>
        <span className={`status-${batch.status}`}>
          {{ pending: '待复核', reviewing: '复核中', passed: '已通过', anomaly: '异常' }[batch.status]}
        </span>
      </div>

      <div className="card p-4">
        <div className="flex gap-2 mb-4">
          {SOURCES.map((s) => (
            <button key={s} className={activeTab === s ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab(s)}>{s}</button>
          ))}
        </div>
        <div className="space-y-3">
          <input className="input-field w-full" placeholder="来源说明" value={sourceDesc} onChange={(e) => setSourceDesc(e.target.value)} />
          {activeTab === '工况记录' ? (
            <div className="grid grid-cols-3 gap-3">
              <input type="number" className="input-field" placeholder="温度(°C)" value={envForm.temperature || ''} onChange={(e) => setEnvForm({ ...envForm, temperature: +e.target.value })} />
              <input type="number" className="input-field" placeholder="湿度(%)" value={envForm.humidity || ''} onChange={(e) => setEnvForm({ ...envForm, humidity: +e.target.value })} />
              <input className="input-field" placeholder="备注" value={envForm.note} onChange={(e) => setEnvForm({ ...envForm, note: e.target.value })} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400"><th>弦别</th><th>标准张力(N)</th><th>实测张力(N)</th></tr></thead>
              <tbody>
                {STRINGS.map((s, i) => (
                  <tr key={s}>
                    <td className="py-1">{s}</td>
                    <td><input type="number" className="input-field w-24 text-center font-mono" value={measForm[i].standardTension || ''} onChange={(e) => { const f = [...measForm]; f[i] = { ...f[i], standardTension: +e.target.value }; setMeasForm(f) }} /></td>
                    <td><input type="number" className="input-field w-24 text-center font-mono" value={measForm[i].measuredTension || ''} onChange={(e) => { const f = [...measForm]; f[i] = { ...f[i], measuredTension: +e.target.value }; setMeasForm(f) }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn-primary" onClick={handleImport}>导入</button>
        </div>
      </div>

      {measurements.length > 0 && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-3">张力数据</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-400 border-b border-surface-border"><th>弦别</th><th>标准张力(N)</th><th>实测张力(N)</th><th>偏差率(%)</th><th>状态</th></tr></thead>
            <tbody>
              {measurements.map((m) => (
                <tr key={m.id} className={`border-b border-surface-border/50 ${m.isAnomaly ? 'bg-data-anomaly/10' : ''}`}>
                  <td className="py-2">{m.stringName}</td>
                  <td className="font-mono">{m.standardTension}</td>
                  <td className="font-mono">{m.measuredTension}</td>
                  <td className={`font-mono ${m.isAnomaly ? 'text-data-anomaly' : 'text-data-normal'}`}>{m.deviationRate > 0 ? '+' : ''}{m.deviationRate}</td>
                  <td>{m.isAnomaly ? <span className="text-data-anomaly text-xs">异常</span> : <span className="text-data-normal text-xs">正常</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {environment && (
            <p className="text-sm text-gray-400 mt-2">工况: {environment.temperature}°C / {environment.humidity}% — {environment.note}</p>
          )}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-3">偏差率图表</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3a5c" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" unit="%" />
              <Tooltip />
              <ReferenceLine y={0} stroke="#6b7280" />
              {STRINGS.map((s) => {
                const tv = threshold.thresholds[s]
                return [<ReferenceLine key={`p${s}`} y={tv} stroke="#4ade80" strokeDasharray="4 4" />, <ReferenceLine key={`n${s}`} y={-tv} stroke="#4ade80" strokeDasharray="4 4" />]
              })}
              <Bar dataKey="deviation" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.isAnomaly ? '#d4443e' : '#4ade80'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {batch.conflicts.length > 0 && (
        <div className="card p-4 border-data-warning/40">
          <h2 className="text-lg font-semibold mb-3 text-data-warning">数据冲突</h2>
          {batch.conflicts.map((c) => (
            <div key={c.id} className="mb-4 p-3 bg-surface-overlay rounded-lg">
              <p className="font-medium mb-2">{c.parameterName}</p>
              <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                <div className="p-2 bg-surface rounded"><span className="text-gray-400">导入({c.importSource}):</span> <span className="font-mono">{c.importValue}</span></div>
                <div className="p-2 bg-surface rounded"><span className="text-gray-400">巡检({c.inspectionSource}):</span> <span className="font-mono">{c.inspectionValue}</span></div>
              </div>
              <p className="text-data-warning text-sm">💡 {c.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">阈值管理</h2>
          <button className="btn-secondary" onClick={() => { setThEdit({ ...threshold.thresholds }); setShowThresholdModal(true) }}>修改阈值</button>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-400">版本: <span className="text-brand">{threshold.version}</span></span>
          {STRINGS.map((s) => <span key={s}>{s}: <span className="font-mono">{threshold.thresholds[s]}%</span></span>)}
        </div>
      </div>

      {showThresholdModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowThresholdModal(false)}>
          <div className="card p-6 w-96 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">修改阈值</h3>
            {STRINGS.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-12">{s}</span>
                <input type="number" className="input-field flex-1" value={thEdit[s]} onChange={(e) => setThEdit({ ...thEdit, [s]: +e.target.value })} />
                <span className="text-gray-400">%</span>
              </div>
            ))}
            <input className="input-field w-full" placeholder="变更原因" value={thReason} onChange={(e) => setThReason(e.target.value)} />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowThresholdModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleThresholdSave}>保存</button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4">
        <h2 className="text-lg font-semibold mb-3">审计日志</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {batch.auditLogs.slice().reverse().map((log) => (
            <div key={log.id} className="flex gap-3 text-sm border-l-2 border-brand pl-3 py-1">
              <span className="text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-brand">{log.action}</span>
              <span className="text-gray-400">{log.actor}</span>
              <span className="text-gray-500">v{log.thresholdVersion}</span>
              <span className="text-gray-300 truncate">{log.reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-surface-border p-4 z-40">
        <div className="container mx-auto flex items-center gap-4">
          <span className="text-sm text-gray-400">阈值版本: <span className="text-brand">{threshold.version}</span></span>
          <input className="input-field flex-1" placeholder="判定原因" value={judgeReason} onChange={(e) => setJudgeReason(e.target.value)} />
          <button className="btn-primary" disabled={!judgeReason.trim() || batch.status === 'passed'} onClick={() => handleJudge('passed')}>判定通过</button>
          <button className="btn-danger" disabled={!judgeReason.trim() || batch.status === 'anomaly'} onClick={() => handleJudge('anomaly')}>判定异常</button>
          <button className="btn-secondary" onClick={() => exportBatchReport(batch)}>导出报告</button>
        </div>
      </div>
    </div>
  )
}
