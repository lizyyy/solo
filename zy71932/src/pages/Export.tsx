import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { StatusBadge } from '@/components/StatusBadge'
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  XCircle,
  Filter,
  X,
} from 'lucide-react'
import type { RecordStatus, LicenseType, AnomalyItem, ExportFilter } from '@/types'

export default function ExportPage() {
  const { records, colorCards, filterRecords, validateExport, exportRecords, exportSnapshots } = useStore()

  const [filter, setFilter] = useState<ExportFilter>({
    statuses: [],
    licenseTypes: [],
    colorCardIds: [],
    search: '',
  })
  const [format, setFormat] = useState<'csv' | 'json'>('json')
  const [anomalies, setAnomalies] = useState<AnomalyItem[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [exporting, setExporting] = useState(false)

  const filtered = useMemo(() => filterRecords(filter), [filterRecords, filter, records])

  const statuses: RecordStatus[] = ['confirmed', 'pending', 'expired', 'conflict']
  const licenseTypes: LicenseType[] = ['商业', '个人', '开源', '自定义']
  const statusLabels: Record<RecordStatus, string> = { confirmed: '已确认', pending: '待确认', expired: '已过期', conflict: '冲突' }

  const toggleFilter = <K extends keyof ExportFilter>(key: K, value: ExportFilter[K] extends (infer U)[] ? U : never) => {
    setFilter((prev) => {
      const arr = prev[key] as unknown as string[]
      const v = value as unknown as string
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
      return { ...prev, [key]: next }
    })
  }

  const handleValidate = () => {
    const ids = filtered.map((r) => r.id)
    const result = validateExport(ids)
    setAnomalies(result)
    setSelectedIds(ids)
  }

  const handleExport = async () => {
    if (!selectedIds) return
    setExporting(true)
    try {
      const snapshot = await exportRecords(selectedIds, format)
      setDeliveryNote(snapshot.deliveryNote)
      setShowNote(true)
    } finally {
      setExporting(false)
    }
  }

  const validIds = selectedIds
    ? anomalies
      ? selectedIds.filter((id) => !anomalies.some((a) => a.recordId === id))
      : selectedIds
    : []

  const anomalyRecordIds = anomalies ? anomalies.map((a) => a.recordId) : []

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">导出与交付</h2>
        <p className="text-sm text-zinc-500 mt-1">筛选记录、校验一致性、生成交付说明</p>
      </div>

      <div className="card px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-zinc-500" />
          <span className="text-sm text-zinc-400">筛选条件</span>
          {(filter.statuses.length > 0 || filter.licenseTypes.length > 0 || filter.colorCardIds.length > 0 || filter.search) && (
            <button onClick={() => setFilter({ statuses: [], licenseTypes: [], colorCardIds: [], search: '' })} className="text-xs text-amber hover:underline">
              清除
            </button>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-12">状态</span>
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => toggleFilter('statuses', s)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  filter.statuses.includes(s) ? 'bg-amber/15 text-amber' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-100'
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-12">授权</span>
            {licenseTypes.map((t) => (
              <button
                key={t}
                onClick={() => toggleFilter('licenseTypes', t)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  filter.licenseTypes.includes(t) ? 'bg-amber/15 text-amber' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 w-12">色卡</span>
            {colorCards.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleFilter('colorCardIds', c.id)}
                className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  filter.colorCardIds.includes(c.id) ? 'bg-amber/15 text-amber' : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-100'
                }`}
              >
                <div className="flex -space-x-0.5">
                  {c.colorValues.slice(0, 2).map((cv, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm border border-surface-200" style={{ backgroundColor: cv.hex }} />
                  ))}
                </div>
                {c.name} v{c.version}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-12">搜索</span>
            <input
              value={filter.search}
              onChange={(e) => setFilter((p) => ({ ...p, search: e.target.value }))}
              placeholder="字体名称、厂商..."
              className="input flex-1 max-w-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          筛选结果：<span className="text-zinc-200 font-mono">{filtered.length}</span> 条记录
        </div>
        <div className="flex items-center gap-3">
          <select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')} className="input">
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button onClick={handleValidate} className="btn-secondary" disabled={filtered.length === 0}>
            <CheckCircle2 size={14} /> 校验一致性
          </button>
          <button onClick={handleExport} className="btn-primary" disabled={!selectedIds || exporting}>
            <Download size={14} /> {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>

      {anomalies !== null && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="px-4 py-3 border-b border-surface-200 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-confirm" />
              <span className="text-sm font-medium text-zinc-300">通过校验</span>
              <span className="badge-confirmed">{validIds.length}</span>
            </div>
            <div className="max-h-[240px] overflow-auto">
              {records.filter((r) => validIds.includes(r.id)).map((r) => (
                <div key={r.id} className="px-4 py-2 border-b border-surface-200/50 flex items-center justify-between last:border-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-confirm" />
                    <span className="text-sm text-zinc-300 font-mono">{r.fontName}</span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
              {validIds.length === 0 && <div className="px-4 py-4 text-center text-xs text-zinc-500">无通过项</div>}
            </div>
          </div>

          <div className="card">
            <div className="px-4 py-3 border-b border-surface-200 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber" />
              <span className="text-sm font-medium text-zinc-300">异常项</span>
              <span className="badge-pending">{anomalies.length}</span>
            </div>
            <div className="max-h-[240px] overflow-auto">
              {anomalies.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-zinc-500">无异常</div>
              ) : (
                anomalies.map((a) => {
                  const r = records.find((rec) => rec.id === a.recordId)
                  return (
                    <div key={a.id} className="px-4 py-2 border-b border-surface-200/50 last:border-0 border-l-2 border-l-amber">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber" />
                        <span className="text-sm text-zinc-300 font-mono">{r?.fontName}</span>
                        <span className="badge-pending">待确认</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 ml-5">{a.reason}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showNote && (
        <div className="card">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">交付说明</span>
            </div>
            <button onClick={() => setShowNote(false)} className="text-zinc-500 hover:text-zinc-300">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 max-h-[300px] overflow-auto">
            <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">{deliveryNote}</pre>
          </div>
        </div>
      )}

      {exportSnapshots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">导出历史</h3>
          {exportSnapshots.slice().reverse().map((s) => (
            <div key={s.id} className="card px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-300">{s.recordCount} 条记录 · {s.anomalyCount} 条异常</div>
                <div className="text-xs text-zinc-500 mt-0.5 font-mono">{new Date(s.timestamp).toLocaleString()} · {s.operator}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-confirmed">{s.recordCount - s.anomalyCount} 通过</span>
                {s.anomalyCount > 0 && <span className="badge-pending">{s.anomalyCount} 待确认</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
