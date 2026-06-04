import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Activity, AlertTriangle, CheckCircle, XCircle, Send } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'

function CurveSection() {
  const records = useStore((s) => s.records)
  const curves = useStore((s) => s.curves)
  const [selectedId, setSelectedId] = useState<string>(curves[0]?.recordId ?? '')

  const curve = curves.find((c) => c.recordId === selectedId)
  const chartData = curve
    ? curve.pressure.map((p, i) => ({ pressure: p, speed: curve.speed[i] }))
    : []
  const record = records.find((r) => r.id === selectedId)

  return (
    <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-amber" />
        <h2 className="text-base font-semibold text-steel-900">曲线参数回放</h2>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-steel-600">选择记录</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-md border border-steel-300 bg-white px-3 py-1.5 text-sm font-mono text-steel-800 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
        >
          {curves.map((c) => {
            const r = records.find((rec) => rec.id === c.recordId)
            return (
              <option key={c.recordId} value={c.recordId}>
                {r ? `${r.batchNo} (${r.id})` : c.recordId}
              </option>
            )
          })}
        </select>
      </div>

      {curve ? (
        <div className="flex gap-5">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                <XAxis
                  dataKey="pressure"
                  type="number"
                  label={{ value: '压力 (Pa)', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  label={{ value: '抽速 (L/s)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="#D97706"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="抽速"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="w-44 flex-shrink-0 space-y-3 rounded-md border border-steel-100 bg-steel-50 p-4">
            <div>
              <p className="text-xs text-steel-500">系数</p>
              <p className="font-mono text-lg font-semibold text-steel-900">{curve.coefficient}</p>
            </div>
            <div>
              <p className="text-xs text-steel-500">版本</p>
              <p className="font-mono text-lg font-semibold text-steel-900">v{curve.version}</p>
            </div>
            {record && (
              <div>
                <p className="text-xs text-steel-500">状态</p>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[record.status]}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-steel-400">暂无曲线数据</p>
      )}
    </section>
  )
}

function CoefficientMarkSection() {
  const records = useStore((s) => s.records)
  const submitCoefficientReason = useStore((s) => s.submitCoefficientReason)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const pendingRecords = records.filter(
    (r) => r.originalCoefficient !== null && r.coefficientChangeReason === null,
  )

  if (pendingRecords.length === 0) return null

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber" />
        <h2 className="text-base font-semibold text-steel-900">人工改系数标记</h2>
        <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-medium text-white">
          {pendingRecords.length}
        </span>
      </div>

      <div className="space-y-3">
        {pendingRecords.map((r) => (
          <div key={r.id} className="rounded-md border border-amber-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-3 text-sm">
              <span className="font-mono font-medium text-steel-800">{r.id}</span>
              <span className="text-steel-400">|</span>
              <span className="text-steel-600">{r.batchNo}</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="font-mono text-steel-500 line-through">{r.originalCoefficient}</span>
              <span className="text-steel-400">→</span>
              <span className="font-mono font-semibold text-amber">{r.coefficient}</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800">
                Δ{(r.coefficient - (r.originalCoefficient ?? 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="请输入修改原因..."
                value={reasons[r.id] ?? ''}
                onChange={(e) => setReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                className="flex-1 rounded-md border border-steel-300 px-3 py-1.5 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
              />
              <button
                onClick={() => {
                  const reason = reasons[r.id]?.trim()
                  if (reason) {
                    submitCoefficientReason(r.id, reason)
                    setReasons((prev) => {
                      const next = { ...prev }
                      delete next[r.id]
                      return next
                    })
                  }
                }}
                disabled={!reasons[r.id]?.trim()}
                className="flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                提交
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function EngineerReviewSection() {
  const records = useStore((s) => s.records)
  const currentRole = useStore((s) => s.currentRole)
  const reviewRecord = useStore((s) => s.reviewRecord)
  const [comments, setComments] = useState<Record<string, string>>({})

  if (currentRole !== 'engineer') return null

  const reviewRecords = records.filter(
    (r) => r.status === 'pending_review' && r.coefficientChangeReason !== null,
  )

  if (reviewRecords.length === 0) return null

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-steel-900">设备工程师复核</h2>
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
          {reviewRecords.length}
        </span>
      </div>

      <div className="space-y-3">
        {reviewRecords.map((r) => (
          <div key={r.id} className="rounded-md border border-steel-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-3 text-sm">
              <span className="font-mono font-medium text-steel-800">{r.id}</span>
              <span className="text-steel-400">|</span>
              <span className="text-steel-600">{r.batchNo}</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="font-mono text-steel-500 line-through">{r.originalCoefficient}</span>
              <span className="text-steel-400">→</span>
              <span className="font-mono font-semibold text-emerald-700">{r.coefficient}</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-mono text-emerald-800">
                Δ{(r.coefficient - (r.originalCoefficient ?? 0)).toFixed(2)}
              </span>
            </div>
            <div className="mb-3 rounded-md bg-steel-50 px-3 py-2 text-sm text-steel-700">
              <span className="font-medium text-steel-500">修改原因：</span>
              {r.coefficientChangeReason}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="复核意见（可选）..."
                value={comments[r.id] ?? ''}
                onChange={(e) => setComments((prev) => ({ ...prev, [r.id]: e.target.value }))}
                className="flex-1 rounded-md border border-steel-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={() => reviewRecord(r.id, true, comments[r.id] ?? '')}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                通过
              </button>
              <button
                onClick={() => reviewRecord(r.id, false, comments[r.id] ?? '')}
                className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                驳回
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ReplayPage() {
  return (
    <div className="space-y-6 font-sans">
      <CurveSection />
      <CoefficientMarkSection />
      <EngineerReviewSection />
    </div>
  )
}
