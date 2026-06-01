import { useAppStore } from '@/store/useAppStore'
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  BarChart3, PieChart as PieChartIcon, FileDown, AlertTriangle, Plus,
  ArrowRight, MessageSquare, Scale, ExternalLink, Clipboard,
} from 'lucide-react'
import type { ExhibitPoint } from '@/types'

const EDITABLE_FIELDS = ['estimatedStayMinutes', 'x', 'y'] as const

export default function SummaryPage() {
  const points = useAppStore(s => s.points)
  const optimizationResult = useAppStore(s => s.optimizationResult)
  const supplements = useAppStore(s => s.supplements)
  const conflicts = useAppStore(s => s.conflicts)
  const highlightedPointId = useAppStore(s => s.highlightedPointId)
  const addSupplement = useAppStore(s => s.addSupplement)
  const setHighlightedPoint = useAppStore(s => s.setHighlightedPoint)
  const getPointById = useAppStore(s => s.getPointById)
  const validationResults = useAppStore(s => s.validationResults)

  const [formPointId, setFormPointId] = useState('')
  const [formField, setFormField] = useState<string>('estimatedStayMinutes')
  const [formNewValue, setFormNewValue] = useState('')
  const [formNote, setFormNote] = useState('')

  if (!optimizationResult) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 text-lg">
        请先完成路线优化
      </div>
    )
  }

  const routePoints = optimizationResult.route
    .map(id => getPointById(id))
    .filter((p): p is ExhibitPoint => p !== undefined)

  const barData = routePoints.map(p => ({
    name: p.name, minutes: p.estimatedStayMinutes ?? 0, id: p.id,
  }))

  const walkMinutes = Math.round(optimizationResult.totalDistance / 80)
  const stayMinutes = routePoints.reduce((s, p) => s + (p.estimatedStayMinutes ?? 0), 0)
  const pieData = [
    { name: '步行时间', value: walkMinutes, group: 'walk' },
    { name: '停留时间', value: stayMinutes, group: 'stay' },
  ]
  const PIE_COLORS = ['#f59e0b', '#10b981']

  const highlightedPoint = highlightedPointId ? getPointById(highlightedPointId) : null

  const currentOldValue = (() => {
    if (!formPointId) return ''
    const pt = getPointById(formPointId)
    if (!pt) return ''
    return String(pt[formField as keyof ExhibitPoint] ?? '')
  })()

  const handleAddSupplement = () => {
    if (!formPointId || !formField || !formNewValue) return
    if (EDITABLE_FIELDS.includes(formField as typeof EDITABLE_FIELDS[number]) && isNaN(Number(formNewValue))) return
    addSupplement({
      pointId: formPointId,
      field: formField,
      oldValue: currentOldValue,
      newValue: formNewValue,
      note: formNote,
    })
    setFormNewValue('')
    setFormNote('')
  }

  const handleExportCSV = () => {
    const headers = ['ID', '名称', 'X', 'Y', '楼层', '停留时间', '单位', '类别', '校验状态', '路线顺序']
    const routeIndexMap = new Map(optimizationResult.route.map((id, i) => [id, i + 1]))
    const rows = points.map(p => {
      const vr = validationResults.find(v => v.pointId === p.id)
      return [
        p.id, p.name, p.x ?? '', p.y ?? '', p.floor,
        p.estimatedStayMinutes ?? '', p.unit, p.category,
        vr?.status ?? 'valid', routeIndexMap.get(p.id) ?? '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'exhibition_route_report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-500" />
          汇总与追溯
        </h2>
        <p className="text-slate-400 text-sm mt-1">点击图表元素可下钻至展点明细，所有数据变更可追溯</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            展点停留时间分布
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={barData}
              onClick={e => {
                const id = e?.activePayload?.[0]?.payload?.id
                if (id) setHighlightedPoint(id)
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]} cursor="pointer">
                {barData.map(entry => (
                  <Cell key={entry.id} fill={entry.minutes > 120 ? '#ef4444' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-amber-500" />
            路线时间构成
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                cursor="pointer"
                onClick={(_entry: unknown, _index: number) => {
                  const firstPoint = routePoints[0]
                  if (firstPoint) setHighlightedPoint(firstPoint.id)
                }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {highlightedPoint && (
        <div className="bg-slate-800 rounded-lg border border-amber-500/30 p-4 transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-amber-500" />
              明细追溯
            </h3>
            <button onClick={() => setHighlightedPoint(null)} className="text-slate-400 hover:text-white text-sm transition-colors">
              关闭
            </button>
          </div>
          <div className="text-sm text-slate-400 mb-3">
            汇总图表 → <span className="text-amber-400">{highlightedPoint.name}</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {([
                ['ID', highlightedPoint.id],
                ['名称', highlightedPoint.name],
                ['X', highlightedPoint.x ?? '-'],
                ['Y', highlightedPoint.y ?? '-'],
                ['楼层', highlightedPoint.floor],
                ['停留时间', highlightedPoint.estimatedStayMinutes ?? '-'],
                ['单位', highlightedPoint.unit],
                ['类别', highlightedPoint.category],
              ] as [string, string | number][]).map(([label, value]) => (
                <tr key={label} className="border-b border-slate-700 last:border-0">
                  <td className="py-1.5 text-slate-400 w-24">{label}</td>
                  <td className="py-1.5 text-white font-mono">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" />
          补录备注
        </h3>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <select
            value={formPointId}
            onChange={e => setFormPointId(e.target.value)}
            className="bg-slate-700 text-white rounded px-2 py-1.5 text-sm border border-slate-600"
          >
            <option value="">选择展点</option>
            {points.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={formField}
            onChange={e => setFormField(e.target.value)}
            className="bg-slate-700 text-white rounded px-2 py-1.5 text-sm border border-slate-600"
          >
            {EDITABLE_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <input
            value={currentOldValue}
            readOnly
            className="bg-slate-900 text-slate-500 rounded px-2 py-1.5 text-sm border border-slate-600 font-mono"
            placeholder="旧值"
          />
          <input
            value={formNewValue}
            onChange={e => setFormNewValue(e.target.value)}
            className="bg-slate-700 text-white rounded px-2 py-1.5 text-sm border border-slate-600 font-mono"
            placeholder="新值"
          />
        </div>
        <div className="flex gap-3 items-start">
          <div className="flex-1 relative">
            <MessageSquare className="absolute left-2 top-2 w-4 h-4 text-slate-500" />
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={2}
              className="w-full bg-slate-700 text-white rounded pl-8 pr-2 py-1.5 text-sm border border-slate-600 resize-none"
              placeholder="备注说明"
            />
          </div>
          <button
            onClick={handleAddSupplement}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-1.5 rounded text-sm transition-colors shrink-0"
          >
            添加补录
          </button>
        </div>

        {supplements.length > 0 && (
          <div className="mt-4 space-y-2">
            {supplements.map(s => {
              const pt = getPointById(s.pointId)
              return (
                <div key={s.id} className="bg-slate-900 rounded p-3 text-sm flex items-center gap-2 flex-wrap">
                  <Clipboard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-white">{pt?.name ?? s.pointId}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">{s.field}</span>
                  <span className="line-through text-red-400 font-mono text-xs">{s.oldValue}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-emerald-400 font-mono text-xs">{s.newValue}</span>
                  {s.note && <span className="text-amber-400 text-xs">「{s.note}」</span>}
                  <span className="text-slate-600 text-xs ml-auto">{s.timestamp}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-red-500/30 p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-red-500" />
            冲突证据
          </h3>
          <div className="space-y-4">
            {conflicts.map(c => (
              <div key={c.id} className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-700 rounded p-3">
                    <div className="text-xs text-slate-400 mb-1">汇总页说法</div>
                    <div className="text-white text-sm">{c.summaryClaim}</div>
                  </div>
                  <div className="bg-slate-700 rounded p-3">
                    <div className="text-xs text-slate-400 mb-1">导入数据证据</div>
                    <div className="text-white text-sm">{c.dataEvidence}</div>
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3">
                  <span className="text-amber-400 text-xs font-semibold">建议动作：</span>
                  <span className="text-amber-200 text-sm ml-1">{c.suggestedAction}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-3">
            <AlertTriangle className="inline w-3 h-3 mr-1" />
            系统不会替您决定，请根据双方证据自行判断
          </p>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FileDown className="w-4 h-4 text-amber-500" />
          导出报告
        </h3>
        <button
          onClick={handleExportCSV}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-1.5 rounded text-sm transition-colors"
        >
          导出 CSV
        </button>
      </div>
    </div>
  )
}
