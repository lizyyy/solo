import { useState, useMemo, Fragment } from 'react'
import { useStore } from '@/lib/store'
import { STATUS_LABELS } from '@/types'
import { generateConflictNote } from '@/lib/merge-detect'
import { FileDown, Filter, BarChart3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import Papa from 'papaparse'

type StatusFilter = '' | 'pending' | 'merged' | 'confirmed' | 'rejected'
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'merged', label: '已归并' },
  { value: 'confirmed', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
]

export default function ExportPage() {
  const { points, getConflictsForPoint } = useStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [hasConflict, setHasConflict] = useState(false)
  const [hasNull, setHasNull] = useState(false)
  const [applied, setApplied] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const districts = useMemo(
    () => [...new Set(points.map(p => p.district).filter(Boolean))].sort(),
    [points],
  )

  const filtered = useMemo(() => {
    if (!applied) return points
    let result = [...points]
    if (statusFilter) result = result.filter(p => p.status === statusFilter)
    if (districtFilter) result = result.filter(p => p.district === districtFilter)
    if (hasConflict) result = result.filter(p => getConflictsForPoint(p.id).length > 0)
    if (hasNull) result = result.filter(p => p.longitude == null || p.latitude == null || !p.name || !p.district)
    return result
  }, [points, applied, statusFilter, districtFilter, hasConflict, hasNull, getConflictsForPoint])

  const confirmedCount = filtered.filter(p => p.status === 'confirmed').length
  const conflictCount = filtered.filter(p => getConflictsForPoint(p.id).length > 0).length

  const periodGroups = useMemo(() => {
    const map = new Map<string, { count: number; conflicts: { name: string; text: string }[] }>()
    for (const p of filtered) {
      const key = p.constructionPeriod || '未填写'
      const existing = map.get(key) || { count: 0, conflicts: [] }
      existing.count++
      const pConflicts = getConflictsForPoint(p.id)
      for (const c of pConflicts) {
        if (c.conflictType === 'capacity_overflow' || c.conflictType === 'time_conflict') {
          existing.conflicts.push({ name: p.name, text: generateConflictNote(c) })
        }
      }
      map.set(key, existing)
    }
    return map
  }, [filtered, getConflictsForPoint])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyFilter = () => setApplied(true)
  const resetFilter = () => {
    setStatusFilter('')
    setDistrictFilter('')
    setHasConflict(false)
    setHasNull(false)
    setApplied(false)
  }

  const exportCSV = () => {
    const rows = filtered.map(p => {
      const pConflicts = getConflictsForPoint(p.id)
      const conflictNote = pConflicts.length
        ? pConflicts.map(c => generateConflictNote(c)).join('; ')
        : '无'
      return {
        路口名称: p.name,
        行政区划: p.district,
        投诉编号: p.complaintId,
        投诉时间: p.complaintTime,
        审批编号: p.approvalRef,
        经度: p.longitude ?? '',
        纬度: p.latitude ?? '',
        设计容量: p.designCapacity ?? '',
        实际需求: p.actualDemand ?? '',
        施工期: p.constructionPeriod,
        养护期: p.maintenancePeriod,
        状态: STATUS_LABELS[p.status] || p.status,
        归并原因: p.mergeReason || '无',
        冲突说明: conflictNote,
        来源追溯: p.sourceTrace || '无',
      }
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `公示清单_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="font-serif-title text-2xl font-semibold text-teal-800">公示清单</h1>
      <p className="text-stone-400 text-sm">筛选、统计与导出公示清单</p>

      <div className="card p-4 mb-5 mt-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-teal-800">
          <Filter className="w-4 h-4" />
          筛选条件
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="select-field"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="select-field"
            value={districtFilter}
            onChange={e => setDistrictFilter(e.target.value)}
          >
            <option value="">全部区域</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" checked={hasConflict} onChange={e => setHasConflict(e.target.checked)} />
            存在冲突
          </label>
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" checked={hasNull} onChange={e => setHasNull(e.target.checked)} />
            存在空值
          </label>
          <button className="btn-primary" onClick={applyFilter}>应用筛选</button>
          <button className="btn-secondary" onClick={resetFilter}>重置</button>
        </div>
      </div>

      <div className="flex gap-4 mb-5">
        <div className="card p-4 flex-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <span className="text-2xl font-bold">{filtered.length}</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">总点位</div>
        </div>
        <div className="card p-4 flex-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sage-700" />
            <span className="text-2xl font-bold text-sage-700">{confirmedCount}</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">已确认</div>
        </div>
        <div className="card p-4 flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-2xl font-bold text-amber-600">{conflictCount}</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">存在冲突</div>
        </div>
      </div>

      <div className="card p-4 mb-5">
        <div className="font-medium text-teal-800 mb-3">跨时段统计</div>
        {[...periodGroups.entries()].map(([period, data]) => (
          <div key={period} className="mb-3 last:mb-0">
            <div className="text-sm font-medium mb-1">
              施工期：{period}（{data.count} 个点位）
            </div>
            {data.conflicts.length > 0 && (
              <ul className="ml-4 space-y-1">
                {data.conflicts.map((c, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {periodGroups.size === 0 && (
          <div className="text-sm text-stone-400">暂无数据</div>
        )}
      </div>

      <div className="card overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left p-2">路口名称</th>
              <th className="text-left p-2">行政区划</th>
              <th className="text-left p-2">投诉编号</th>
              <th className="text-left p-2">审批编号</th>
              <th className="text-left p-2">状态</th>
              <th className="text-left p-2">归并原因</th>
              <th className="text-left p-2">冲突说明</th>
              <th className="text-left p-2">来源追溯</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const pConflicts = getConflictsForPoint(p.id)
              const isExpanded = expandedIds.has(p.id)
              return (
                <Fragment key={p.id}>
                  <tr
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => toggleExpand(p.id)}
                  >
                    <td className="p-2 font-medium">{p.name || '—'}</td>
                    <td className="p-2">{p.district || '—'}</td>
                    <td className="p-2">{p.complaintId || '—'}</td>
                    <td className="p-2">{p.approvalRef || '—'}</td>
                    <td className="p-2">
                      <span className={`status-badge-${p.status} px-2 py-0.5 rounded text-xs font-medium`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="p-2 max-w-[160px] truncate">{p.mergeReason || '—'}</td>
                    <td className="p-2 max-w-[200px] truncate">
                      {pConflicts.length
                        ? pConflicts.map(c => generateConflictNote(c)).join('; ')
                        : '—'}
                    </td>
                    <td className="p-2 text-xs text-stone-500 max-w-[120px] truncate">
                      {p.sourceTrace || '—'}
                    </td>
                    <td className="p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-stone-50">
                      <td colSpan={9} className="p-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>经度：{p.longitude?.toFixed(6) ?? '未填写'}</div>
                          <div>纬度：{p.latitude?.toFixed(6) ?? '未填写'}</div>
                          <div>设计容量：{p.designCapacity ?? '未填写'}{p.designCapacity ? ' m³' : ''}</div>
                          <div>实际需求：{p.actualDemand ?? '未填写'}{p.actualDemand ? ' m³' : ''}</div>
                          <div>施工期：{p.constructionPeriod || '未填写'}</div>
                          <div>养护期：{p.maintenancePeriod || '未填写'}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-stone-400 py-8">暂无数据</div>
        )}
      </div>

      <button className="btn-primary inline-flex items-center gap-2" onClick={exportCSV}>
        <FileDown className="w-4 h-4" />
        导出公示清单CSV
      </button>
    </div>
  )
}
