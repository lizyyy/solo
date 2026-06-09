import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/AppStore'
import { StatusBadge, ShiftBadge, SourceBadge, formatDateTime } from './StatusBadge'
import type { PumpStatus, ShiftType } from '../types'
import { Search, Filter, Eye, History, Download, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { METRIC_LABELS } from '../data/thresholds'

interface Props {
  onSelect: (id: string) => void
}

export const InspectionList: React.FC<Props> = ({ onSelect }) => {
  const { inspections, selectedInspectionId, exportSelection, resetAll } = useAppStore()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PumpStatus>('all')
  const [shiftFilter, setShiftFilter] = useState<'all' | ShiftType>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const filtered = useMemo(() => {
    return inspections
      .filter((i) => !keyword || i.pumpName.includes(keyword) || i.pumpId.includes(keyword) || i.id.includes(keyword))
      .filter((i) => statusFilter === 'all' || i.status === statusFilter)
      .filter((i) => shiftFilter === 'all' || i.shift === shiftFilter)
      .sort((a, b) => b.createTime.localeCompare(a.createTime))
  }, [inspections, keyword, statusFilter, shiftFilter])

  const toggle = (id: string) =>
    setSelectedIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]))

  const handleExport = () => {
    const ids = selectedIds.length ? selectedIds : filtered.map((i) => i.id)
    const { csv, hash, formulaVersion } = exportSelection(ids)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `泵站巡检导出_${formulaVersion}_${hash}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">巡检记录</h2>
            <span className="text-xs text-slate-500">{filtered.length} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索泵号/名称/编号"
                className="pl-8 pr-3 py-1.5 text-sm w-52 rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {(['all', 'normal', 'warning', 'critical', 'pending_confirm'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx('px-2 py-1 text-xs rounded transition', statusFilter === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  {s === 'all' ? '全部' : <StatusBadge status={s} />}
                </button>
              ))}
            </div>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as any)}
              className="text-sm rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="all">全部班次</option>
              <option value="morning">早班</option>
              <option value="afternoon">中班</option>
              <option value="night">夜班</option>
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
              title="导出选中或当前过滤结果"
            >
              <Download className="w-3.5 h-3.5" />
              导出CSV
            </button>
            <button
              onClick={() => {
                if (confirm('确定要重置所有数据到种子演示状态吗？')) {
                  resetAll()
                  setSelectedIds([])
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition"
              title="重置为演示数据"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr className="text-left text-slate-500">
              <th className="px-5 py-2.5 font-medium w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => setSelectedIds(e.target.checked ? filtered.map((i) => i.id) : [])}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-2 py-2.5 font-medium">编号</th>
              <th className="px-2 py-2.5 font-medium">泵站</th>
              <th className="px-2 py-2.5 font-medium">日期/班次</th>
              <th className="px-2 py-2.5 font-medium">状态</th>
              <th className="px-2 py-2.5 font-medium">来源</th>
              {Object.keys(METRIC_LABELS).map((k) => (
                <th key={k} className="px-2 py-2.5 font-medium text-right">{METRIC_LABELS[k].split(' ')[0]}</th>
              ))}
              <th className="px-2 py-2.5 font-medium">巡检人</th>
              <th className="px-2 py-2.5 font-medium">更新</th>
              <th className="px-5 py-2.5 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.id}
                onClick={() => onSelect(i.id)}
                className={clsx('border-b border-slate-100 cursor-pointer transition hover:bg-brand-50/40', {
                  'bg-brand-50/60': selectedInspectionId === i.id,
                })}
              >
                <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(i.id)}
                    onChange={() => toggle(i.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="px-2 py-2.5 font-mono text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    {i.id}
                    {i.rerunCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 bg-violet-50 px-1 py-0.5 rounded">
                        <History className="w-3 h-3" />{i.rerunCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="font-medium text-slate-800">{i.pumpName}</div>
                  <div className="text-xs text-slate-500">{i.pumpId}</div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="text-slate-700">{i.inspectionDate}</div>
                  <ShiftBadge shift={i.shift} />
                </td>
                <td className="px-2 py-2.5"><StatusBadge status={i.status} /></td>
                <td className="px-2 py-2.5"><SourceBadge source={i.source} /></td>
                {Object.keys(METRIC_LABELS).map((k) => {
                  const val = (i.metrics as any)[k] as number
                  const alert = i.alerts.find((a) => a.metric === k)
                  return (
                    <td key={k} className={clsx('px-2 py-2.5 text-right tabular-nums', {
                      'text-red-600 font-semibold': alert?.level === 'critical',
                      'text-amber-600 font-medium': alert?.level === 'warning',
                      'text-slate-700': !alert,
                    })}>
                      {val}
                    </td>
                  )
                })}
                <td className="px-2 py-2.5 text-slate-600">{i.inspector}</td>
                <td className="px-2 py-2.5 text-slate-500 text-xs">{formatDateTime(i.updateTime)}</td>
                <td className="px-5 py-2.5 text-right">
                  <button className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 transition">
                    <Eye className="w-3.5 h-3.5" /> 详情
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={15} className="px-5 py-10 text-center text-slate-400 text-sm">没有匹配的巡检记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
        <span>已选 {selectedIds.length} / 共 {filtered.length} 条，导出时会记录口径版本哈希</span>
        <span>口径版本 v2.3.1 &nbsp;·&nbsp; 导出CSV含UTF-8 BOM</span>
      </div>
    </div>
  )
}
