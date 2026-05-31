import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueueStore } from '@/store'
import type { StatusType, SourceType } from '@shared/types'
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Copy,
  ChevronRight,
  FileText,
  ClipboardList,
} from 'lucide-react'

const COLUMNS: { status: StatusType; label: string; colorKey: string }[] = [
  { status: '待草表', label: '待草表', colorKey: 'status-draft' },
  { status: '待确认', label: '待确认', colorKey: 'status-confirm' },
  { status: '已完成', label: '已完成', colorKey: 'status-done' },
  { status: '已驳回', label: '已驳回', colorKey: 'status-reject' },
]

const SOURCE_OPTIONS: { value: SourceType | undefined; label: string }[] = [
  { value: undefined, label: '全部' },
  { value: '活动复盘', label: '活动复盘' },
  { value: '关卡草表', label: '关卡草表' },
]

function formatTime(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export default function Kanban() {
  const navigate = useNavigate()
  const { records, loading, filters, fetchRecords, setFilters } = useQueueStore()
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  useEffect(() => {
    fetchRecords()
  }, [filters.source, filters.status, filters.search])

  const handleSourceChange = (value: string) => {
    const source = value === '全部' ? undefined : (value as SourceType)
    setFilters({ source })
  }

  const handleSearch = () => {
    setFilters({ search: searchInput || undefined })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleRefresh = () => {
    fetchRecords()
  }

  const columnRecords = (status: StatusType) =>
    records.filter((r) => r.status === status)

  return (
    <div className="flex flex-col h-full">
      {/* Top filter bar */}
      <div className="shrink-0 bg-port-surface border-b border-port-border px-6 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-port-orange">
            <ClipboardList className="w-5 h-5" />
            <h1 className="text-lg font-bold text-port-text">排队看板</h1>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <select
              value={filters.source ?? '全部'}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="bg-port-card border border-port-border rounded-lg px-3 py-2 text-sm text-port-text focus:outline-none focus:border-port-orange transition-colors appearance-none cursor-pointer min-w-[120px]"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-port-muted" />
              <input
                type="text"
                placeholder="搜索活动ID或内容..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="bg-port-card border border-port-border rounded-lg pl-9 pr-4 py-2 text-sm text-port-text placeholder:text-port-muted focus:outline-none focus:border-port-orange transition-colors w-56"
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-port-orange hover:bg-port-orange-light text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid grid-cols-4 gap-4 h-full">
          {COLUMNS.map((col) => {
            const items = columnRecords(col.status)
            return (
              <div
                key={col.status}
                className="flex flex-col bg-port-surface/50 rounded-xl border border-port-border overflow-hidden"
              >
                {/* Column header */}
                <div className="shrink-0 px-4 py-3 border-b border-port-border bg-port-surface">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full bg-${col.colorKey}`}
                      style={{
                        backgroundColor:
                          col.colorKey === 'status-draft'
                            ? '#3b82f6'
                            : col.colorKey === 'status-confirm'
                            ? '#eab308'
                            : col.colorKey === 'status-done'
                            ? '#22c55e'
                            : '#ef4444',
                      }}
                    />
                    <span className="text-sm font-semibold text-port-text">
                      {col.label}
                    </span>
                    <span className="ml-auto bg-port-card text-port-muted text-xs font-medium px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Card list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-port-muted">
                      <FileText className="w-8 h-8 mb-2 opacity-40" />
                      <span className="text-xs">暂无记录</span>
                    </div>
                  ) : (
                    items.map((record) => (
                      <div
                        key={record.id}
                        onClick={() => navigate(`/record/${record.id}`)}
                        className={`group relative bg-port-card rounded-lg border border-port-border p-4 cursor-pointer transition-all duration-200 hover:border-port-orange/50 hover:shadow-lg hover:shadow-port-orange/5 hover:-translate-y-0.5 ${
                          record.isAnomaly
                            ? 'border-l-[3px] border-l-red-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-bold text-port-text group-hover:text-port-orange transition-colors">
                            {record.activityId}
                          </span>
                          <ChevronRight className="w-4 h-4 text-port-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                        </div>

                        <div className="flex items-center gap-2 mb-2.5">
                          <span
                            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${
                              record.source === '活动复盘'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-purple-500/15 text-purple-400'
                            }`}
                          >
                            {record.source}
                          </span>
                          {record.isDuplicate && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-port-orange/15 text-port-orange">
                              <Copy className="w-3 h-3" />
                              重复
                            </span>
                          )}
                          {record.isAnomaly && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-red-500/15 text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              异常
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-port-muted leading-relaxed mb-3 line-clamp-2">
                          {record.content}
                        </p>

                        <div className="flex items-center justify-between text-xs text-port-muted">
                          <span>{record.submittedBy}</span>
                          <span>{formatTime(record.submittedAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
