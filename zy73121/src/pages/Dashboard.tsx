import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  PauseCircle,
  PlusCircle,
  Download,
  RotateCcw,
  ChevronDown,
  Table2,
} from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/utils/types'
import type { AnomalyType, RecordStatus } from '@/utils/types'
import { exportToCSV } from '@/utils/exportData'

const BUOY_OPTIONS = ['BY-001', 'BY-002', 'BY-003', 'BY-004', 'BY-005']

const statusBadgeClass: Record<RecordStatus, string> = {
  UNCONFIRMED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  SUSPENDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse',
  RESOLVED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function MetricBar() {
  const anomalies = useAnomalyStore((s) => s.anomalies)

  const total = anomalies.length
  const suspended = anomalies.filter((a) => a.status === 'SUSPENDED').length
  const todayStart = getTodayStart().getTime()
  const todayNew = anomalies.filter((a) => new Date(a.createdAt).getTime() >= todayStart).length

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50 glow-green">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">异常总数</p>
            <p className="font-mono text-3xl font-bold text-[#00E5A0] mt-2 tabular-nums">{total}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-[#00E5A0]/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#00E5A0]" />
          </div>
        </div>
      </div>
      <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50 glow-orange">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">挂起待确认</p>
            <p className="font-mono text-3xl font-bold text-[#FF6B35] mt-2 tabular-nums">{suspended}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
            <PauseCircle className="w-6 h-6 text-[#FF6B35]" />
          </div>
        </div>
      </div>
      <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">今日新增</p>
            <p className="font-mono text-3xl font-bold text-[#F8FAFC] mt-2 tabular-nums">{todayNew}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-slate-700/40 flex items-center justify-center">
            <PlusCircle className="w-6 h-6 text-[#F8FAFC]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterPanel() {
  const filter = useAnomalyStore((s) => s.filter)
  const setFilter = useAnomalyStore((s) => s.setFilter)
  const resetFilter = useAnomalyStore((s) => s.resetFilter)

  const inputBase =
    'bg-[#1E293B] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#00E5A0]/60 focus:ring-1 focus:ring-[#00E5A0]/40 transition'

  return (
    <div className="bg-[#1E293B]/60 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[#00E5A0]/10 flex items-center justify-center">
            <ChevronDown className="w-4 h-4 text-[#00E5A0]" />
          </div>
          <h3 className="text-slate-200 font-semibold">筛选口径</h3>
        </div>
        <button
          onClick={resetFilter}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">浮标编号</label>
          <select
            value={filter.buoyId}
            onChange={(e) => setFilter({ buoyId: e.target.value })}
            className={inputBase + ' w-full'}
          >
            <option value="">全部浮标</option>
            {BUOY_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">异常类型</label>
          <select
            value={filter.anomalyType}
            onChange={(e) => setFilter({ anomalyType: e.target.value as AnomalyType | '' })}
            className={inputBase + ' w-full'}
          >
            <option value="">全部类型</option>
            {(Object.keys(ANOMALY_TYPE_LABELS) as AnomalyType[]).map((t) => (
              <option key={t} value={t}>{ANOMALY_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">确认状态</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ status: e.target.value as RecordStatus | '' })}
            className={inputBase + ' w-full'}
          >
            <option value="">全部状态</option>
            {(Object.keys(STATUS_LABELS) as RecordStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">起始日期</label>
          <input
            type="date"
            value={filter.dateFrom}
            onChange={(e) => setFilter({ dateFrom: e.target.value })}
            className={inputBase + ' w-full'}
          />
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">结束日期</label>
          <input
            type="date"
            value={filter.dateTo}
            onChange={(e) => setFilter({ dateTo: e.target.value })}
            className={inputBase + ' w-full'}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="apply-export"
            checked={filter.applyToExport}
            onChange={(e) => setFilter({ applyToExport: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-[#00E5A0]"
          />
          <label htmlFor="apply-export" className="text-sm text-slate-300 select-none cursor-pointer">
            口径应用到导出
          </label>
        </div>
      </div>
    </div>
  )
}

function AnomalyTable() {
  const navigate = useNavigate()
  const getFilteredAnomalies = useAnomalyStore((s) => s.getFilteredAnomalies)
  const getRemarksByRecordId = useAnomalyStore((s) => s.getRemarksByRecordId)

  const records = useMemo(() => getFilteredAnomalies(), [getFilteredAnomalies])

  return (
    <div className="bg-[#1E293B]/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
        <Table2 className="w-4 h-4 text-slate-400" />
        <h3 className="text-slate-200 font-semibold">异常记录列表</h3>
        <span className="ml-auto text-xs text-slate-500">共 {records.length} 条记录</span>
      </div>
      <div className="overflow-x-auto max-h-[calc(100vh-420px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1E293B] sticky top-0 z-10">
            <tr className="text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">浮标编号</th>
              <th className="text-left px-5 py-3 font-medium">传感器时间</th>
              <th className="text-left px-5 py-3 font-medium">纬度</th>
              <th className="text-left px-5 py-3 font-medium">经度</th>
              <th className="text-left px-5 py-3 font-medium">异常类型</th>
              <th className="text-left px-5 py-3 font-medium">状态</th>
              <th className="text-left px-5 py-3 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-500">
                  当前筛选条件下暂无记录
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const remarks = getRemarksByRecordId(r.id)
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/record/${r.id}`)}
                    className="border-t border-slate-800/60 hover:bg-[#0A2540]/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-[#00E5A0]">{r.buoyId}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-mono text-xs">
                      {formatDate(r.sensorTimestamp)}
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-mono text-xs">{r.sensorLat.toFixed(4)}</td>
                    <td className="px-5 py-4 text-slate-300 font-mono text-xs">{r.sensorLng.toFixed(4)}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">
                        {ANOMALY_TYPE_LABELS[r.anomalyType]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-md border text-xs ${statusBadgeClass[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {remarks.length > 0 ? `${remarks.length} 条` : '-'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExportButton() {
  const anomalies = useAnomalyStore((s) => s.anomalies)
  const filter = useAnomalyStore((s) => s.filter)
  const getFilteredAnomalies = useAnomalyStore((s) => s.getFilteredAnomalies)
  const [open, setOpen] = useState(false)

  const handleExport = useCallback(
    (scope: 'filtered' | 'all') => {
      const data = scope === 'filtered' ? getFilteredAnomalies() : anomalies
      exportToCSV(data, filter)
      setOpen(false)
    },
    [anomalies, filter, getFilteredAnomalies]
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] hover:bg-[#00cc8e] text-[#0A2540] font-semibold rounded-lg transition-colors shadow-lg shadow-[#00E5A0]/10"
      >
        <Download className="w-4 h-4" />
        导出
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[#1E293B] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => handleExport('filtered')}
            className="w-full text-left px-4 py-3 hover:bg-[#0A2540]/60 text-slate-200 text-sm transition"
          >
            导出当前筛选
            <div className="text-xs text-slate-500 mt-0.5">
              {getFilteredAnomalies().length} 条，{filter.applyToExport ? '带口径参数' : '不含口径'}
            </div>
          </button>
          <div className="border-t border-slate-800" />
          <button
            onClick={() => handleExport('all')}
            className="w-full text-left px-4 py-3 hover:bg-[#0A2540]/60 text-slate-200 text-sm transition"
          >
            导出全部
            <div className="text-xs text-slate-500 mt-0.5">
              {anomalies.length} 条，含筛选口径参数
            </div>
          </button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}

export default function Dashboard() {
  const initialize = useAnomalyStore((s) => s.initialize)

  useMemo(() => {
    initialize()
  }, [initialize])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">异常队列</h1>
        <ExportButton />
      </div>
      <MetricBar />
      <FilterPanel />
      <AnomalyTable />
    </div>
  )
}
