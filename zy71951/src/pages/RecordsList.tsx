import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, ChevronLeft, ChevronRight, CheckSquare, ArrowRight } from 'lucide-react'
import api from '@/utils/api'
import type { InspectionRecord, GetRecordsResponse, RecordStatus } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '警告' },
  { value: 'critical', label: '严重' },
  { value: 'corrected', label: '已修正' },
]

const ANOMALY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'no_fly_zone', label: '禁飞区擦边' },
  { value: 'data_integrity', label: '数据完整性' },
  { value: 'anomaly', label: '异常检测' },
  { value: 'custom', label: '自定义规则' },
]

const PAGE_SIZE = 10

function TruncatedText({ text, maxLines = 2 }: { text: string; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="max-w-xs">
      <p
        className={cn('text-sm text-gray-500 leading-relaxed', !expanded && `line-clamp-${maxLines}`)}
        style={!expanded ? { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      {text.length > 60 && (
        <button
          type="button"
          className="text-xs text-steel hover:underline mt-0.5"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  )
}

export default function RecordsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { setFilters, syncFiltersFromURL } = useAppStore()

  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchConfirming, setBatchConfirming] = useState(false)

  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')
  const [towerId, setTowerId] = useState(searchParams.get('towerId') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [anomalyType, setAnomalyType] = useState(searchParams.get('anomalyType') || '')

  useEffect(() => {
    syncFiltersFromURL(searchParams)
  }, [searchParams, syncFiltersFromURL])

  useEffect(() => {
    const p = new URLSearchParams()
    if (page > 1) p.set('page', String(page))
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    if (towerId) p.set('towerId', towerId)
    if (status) p.set('status', status)
    if (anomalyType) p.set('anomalyType', anomalyType)
    setSearchParams(p, { replace: true })
  }, [page, dateFrom, dateTo, towerId, status, anomalyType, setSearchParams])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<GetRecordsResponse>('/records', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          towerId: towerId || undefined,
          status: status || undefined,
          anomalyType: anomalyType || undefined,
        },
      })
      setRecords(res.records)
      setTotal(res.total)
    } catch {
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo, towerId, status, anomalyType])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  function handleSearch() {
    setPage(1)
    setFilters({ dateRange: dateFrom && dateTo ? [dateFrom, dateTo] : null, towerId: towerId || null, status: status || null })
    fetchRecords()
  }

  function handleReset() {
    setDateFrom('')
    setDateTo('')
    setTowerId('')
    setStatus('')
    setAnomalyType('')
    setPage(1)
    setFilters({ dateRange: null, towerId: null, status: null })
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)))
    }
  }

  async function handleBatchConfirm() {
    if (selectedIds.size === 0) return
    setBatchConfirming(true)
    try {
      const user = useAppStore.getState().currentUser
      for (const id of selectedIds) {
        const record = records.find((r) => r.id === id)
        if (record) {
          for (const j of record.judgments.filter((j) => !j.confirmed)) {
            await api.post(`/records/${id}/judgments/${j.id}/confirm`, {
              judgmentId: j.id,
              confirmedBy: user.name,
            })
          }
        }
      }
      setSelectedIds(new Set())
      fetchRecords()
    } finally {
      setBatchConfirming(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const judgmentSummary = (record: InspectionRecord) => {
    if (record.judgments.length === 0) return '无异常判断'
    return record.judgments.map((j) => j.reasoning).join('；')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">巡检记录</h1>
        <span className="text-sm text-gray-400">共 {total} 条记录</span>
      </div>

      <div className="card card-body">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">开始日期</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-base w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">结束日期</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-base w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">杆塔编号</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={towerId}
                onChange={(e) => setTowerId(e.target.value)}
                placeholder="搜索杆塔编号"
                className="input-base w-44 pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base w-32">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">异常类型</label>
            <select value={anomalyType} onChange={(e) => setAnomalyType(e.target.value)} className="input-base w-36">
              {ANOMALY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleSearch}>
              <Filter className="w-4 h-4" />
              筛选
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={handleReset}>
              重置
            </button>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="card card-body flex items-center gap-4 bg-amber-50 border-amber-200">
          <span className="text-sm text-amber-800 font-medium">已选择 {selectedIds.size} 条记录</span>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={batchConfirming}
            onClick={handleBatchConfirm}
          >
            <CheckSquare className="w-4 h-4" />
            {batchConfirming ? '批量确认中…' : '批量确认'}
          </button>
          <button type="button" className="text-sm text-gray-500 hover:text-primary" onClick={() => setSelectedIds(new Set())}>
            取消选择
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-steel border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <EmptyState title="暂无巡检记录" description="调整筛选条件或等待新数据导入" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-steel focus:ring-steel/30"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">杆塔编号</th>
                  <th className="px-4 py-3 font-medium">杆塔名称</th>
                  <th className="px-4 py-3 font-medium">飞行日期</th>
                  <th className="px-4 py-3 font-medium">飞手</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">判断理由摘要</th>
                  <th className="px-4 py-3 font-medium w-16">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={cn(
                      'hover:bg-gray-50/80 cursor-pointer transition-colors',
                      selectedIds.has(record.id) && 'bg-amber-50/40'
                    )}
                    onClick={() => navigate(`/records/${record.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded border-gray-300 text-steel focus:ring-steel/30"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{record.towerId}</td>
                    <td className="px-4 py-3 text-primary">{record.towerName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{record.flightDate}</td>
                    <td className="px-4 py-3 text-gray-500">{record.pilotName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status as RecordStatus} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <TruncatedText text={judgmentSummary(record)} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="text-steel hover:text-accent transition-colors"
                        onClick={() => navigate(`/records/${record.id}`)}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              第 {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} 条，共 {total} 条
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-gray-300 text-xs">…</span>
                    )}
                    <button
                      type="button"
                      className={cn(
                        'w-8 h-8 rounded-md text-sm transition-colors',
                        p === page ? 'bg-steel text-white font-medium' : 'text-gray-500 hover:bg-gray-100'
                      )}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
