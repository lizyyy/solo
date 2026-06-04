import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  History,
  Download,
  Filter,
  Search,
  RotateCcw,
  GitCompare,
  User,
  Calendar,
  Table,
  List,
  Cpu,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import DiffModal from '@/components/DiffModal'
import ConfirmModal from '@/components/ConfirmModal'
import {
  getHistory,
  getHistoryDiff,
  rollbackHistory,
  exportHistory,
} from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import type { ChangeRecord } from '@/types'

type ViewMode = 'table' | 'timeline'

const fieldLabels: Record<string, string> = {
  rpm_min: '最小转速',
  rpm_max: '最大转速',
  coefficient: '安全系数',
  coefficient_reason: '修改原因',
  remark: '备注',
  review_status: '复核状态',
  review_comment: '复核意见',
}

const targetTypeLabels: Record<string, string> = {
  sensor: '传感器',
  'safety-zone': '安全区',
}

interface TimelineGroup {
  date: string
  records: ChangeRecord[]
}

export default function HistoryPage() {
  const { fetchStats } = useAppStore()

  const [records, setRecords] = useState<ChangeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [searchTerm, setSearchTerm] = useState('')
  const [targetType, setTargetType] = useState<'all' | 'sensor' | 'safety-zone'>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [diffModal, setDiffModal] = useState<{
    isOpen: boolean
    recordId: string | null
  }>({
    isOpen: false,
    recordId: null,
  })

  const [rollbackModal, setRollbackModal] = useState<{
    isOpen: boolean
    record: ChangeRecord | null
  }>({
    isOpen: false,
    record: null,
  })

  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: Parameters<typeof getHistory>[0] = {
        page,
        pageSize,
      }
      if (targetType !== 'all') {
        params.targetType = targetType
      }

      const response = await getHistory(params)

      let filtered = response.data
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filtered = filtered.filter(
          (r) =>
            r.target_id.toLowerCase().includes(term) ||
            r.operator.toLowerCase().includes(term) ||
            (r.reason && r.reason.toLowerCase().includes(term))
        )
      }

      if (dateRange.start) {
        const start = new Date(dateRange.start)
        filtered = filtered.filter((r) => new Date(r.created_at) >= start)
      }
      if (dateRange.end) {
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        filtered = filtered.filter((r) => new Date(r.created_at) <= end)
      }

      setRecords(filtered)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取历史记录失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, targetType, searchTerm, dateRange])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleDiffClick = (record: ChangeRecord) => {
    setDiffModal({
      isOpen: true,
      recordId: record.id,
    })
  }

  const handleRollbackClick = (record: ChangeRecord) => {
    setRollbackModal({
      isOpen: true,
      record,
    })
  }

  const handleRollbackConfirm = async () => {
    if (!rollbackModal.record) return

    setRollbackLoading(true)
    try {
      await rollbackHistory(rollbackModal.record.id, '手动回滚历史记录')
      setRollbackModal({ isOpen: false, record: null })
      loadHistory()
      fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : '回滚失败')
    } finally {
      setRollbackLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    setError(null)

    try {
      const params: Parameters<typeof exportHistory>[0] = {}
      if (targetType !== 'all') {
        params.targetType = targetType
      }
      if (dateRange.start) params.startDate = dateRange.start
      if (dateRange.end) params.endDate = dateRange.end

      const blob = await exportHistory(params)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `history-export-${new Date().toISOString().split('T')[0]}.sh`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const timelineGroups = useMemo<TimelineGroup[]>(() => {
    const groups: Record<string, ChangeRecord[]> = {}
    records.forEach((record) => {
      const date = record.created_at.split('T')[0]
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(record)
    })
    return Object.entries(groups)
      .map(([date, items]) => ({
        date,
        records: items.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [records])

  const totalPages = Math.ceil(total / pageSize)

  const getChangeSummary = (record: ChangeRecord) => {
    const field = fieldLabels[record.field] || record.field
    const targetType = targetTypeLabels[record.target_type] || record.target_type
    return `${targetType} ${record.target_id} 的 ${field} 从 ${record.old_value} 变更为 ${record.new_value}`
  }

  const getTypeIcon = (type: string) => {
    if (type === 'sensor') return <Cpu className="h-4 w-4" />
    return <ShieldCheck className="h-4 w-4" />
  }

  const getTypeColor = (type: string) => {
    if (type === 'sensor') return 'bg-blue-500'
    return 'bg-purple-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">变更历史</h1>
          <p className="mt-1 text-sm text-muted">查看所有数据变更记录和操作日志</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              title="表格视图"
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={clsx(
                'p-2 rounded-md transition-colors',
                viewMode === 'timeline'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
              title="时间线视图"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {exportLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                导出记录
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="搜索传感器编号、操作人..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as 'all' | 'sensor' | 'safety-zone')
              setPage(1)
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">全部类型</option>
            <option value="sensor">传感器</option>
            <option value="safety-zone">安全区</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange({ ...dateRange, start: e.target.value })
                setPage(1)
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-muted">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange({ ...dateRange, end: e.target.value })
                setPage(1)
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-danger">加载出错</p>
            <p className="text-sm text-danger/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted">加载数据中...</p>
              </div>
            </div>
          )}

          {!loading && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        目标
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        字段
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        变更前
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        变更后
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        操作人
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        原因
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-gray-600">
                            {new Date(item.created_at).toLocaleString('zh-CN')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                                item.target_type === 'sensor'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              )}
                            >
                              {targetTypeLabels[item.target_type] || item.target_type}
                            </span>
                            <span className="font-mono text-sm text-gray-900">
                              {item.target_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {fieldLabels[item.field] || item.field}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-danger line-through">
                            {item.old_value}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-success font-medium">
                            {item.new_value}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200">
                              <User className="h-3.5 w-3.5 text-gray-600" />
                            </div>
                            <span className="text-sm text-gray-700">{item.operator}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.reason ? (
                            <span className="text-sm text-gray-700">{item.reason}</span>
                          ) : (
                            <span className="text-xs text-danger">无原因</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDiffClick(item)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                              title="查看差异"
                            >
                              <GitCompare className="h-3.5 w-3.5" />
                              对比
                            </button>
                            <button
                              onClick={() => handleRollbackClick(item)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              title="回滚"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              回滚
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {records.length === 0 && (
                <div className="py-12 text-center">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted">暂无历史记录</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-muted">
                    共 {total} 条记录，当前第 {page} / {totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <span className="text-sm text-gray-600 px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted">加载数据中...</p>
              </div>
            </div>
          )}

          {!loading && (
            <div className="p-6">
              {timelineGroups.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted">暂无历史记录</p>
                </div>
              ) : (
                timelineGroups.map((group) => (
                  <div key={group.date} className="mb-8 last:mb-0">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <h3 className="text-sm font-semibold text-gray-700">
                        {new Date(group.date).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long',
                        })}
                      </h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-muted">
                        {group.records.length} 条变更
                      </span>
                    </div>

                    <div className="relative pl-6">
                      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-200" />

                      {group.records.map((record, index) => (
                        <div
                          key={record.id}
                          className={clsx(
                            'relative flex gap-4 py-4',
                            index < group.records.length - 1 ? '' : ''
                          )}
                        >
                          <div
                            className={clsx(
                              'absolute -left-6 mt-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white',
                              getTypeColor(record.target_type)
                            )}
                          >
                            {getTypeIcon(record.target_type)}
                          </div>

                          <div className="flex-1 bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span
                                    className={clsx(
                                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                                      record.target_type === 'sensor'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-purple-100 text-purple-700'
                                    )}
                                  >
                                    {targetTypeLabels[record.target_type]}
                                  </span>
                                  <span className="font-mono text-sm font-medium text-gray-900">
                                    {record.target_id}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">
                                  {getChangeSummary(record)}
                                </p>
                                {record.reason && (
                                  <p className="text-sm text-muted">
                                    原因：{record.reason}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {record.operator}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(record.created_at).toLocaleTimeString('zh-CN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDiffClick(record)}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="查看差异"
                                >
                                  <GitCompare className="h-3.5 w-3.5" />
                                  对比
                                </button>
                                <button
                                  onClick={() => handleRollbackClick(record)}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  title="回滚"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  回滚
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <DiffModal
        isOpen={diffModal.isOpen}
        onClose={() => setDiffModal({ isOpen: false, recordId: null })}
        recordId={diffModal.recordId}
        fetchDiff={getHistoryDiff}
      />

      <ConfirmModal
        isOpen={rollbackModal.isOpen}
        onClose={() => setRollbackModal({ isOpen: false, record: null })}
        onConfirm={handleRollbackConfirm}
        title="确认回滚"
        message={
          <div className="space-y-2">
            <p>此操作将回滚以下变更，可能影响相关数据的一致性：</p>
            {rollbackModal.record && (
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-sm">
                  <span className="font-medium">目标：</span>
                  {targetTypeLabels[rollbackModal.record.target_type]}{' '}
                  {rollbackModal.record.target_id}
                </p>
                <p className="text-sm">
                  <span className="font-medium">字段：</span>
                  {fieldLabels[rollbackModal.record.field] || rollbackModal.record.field}
                </p>
                <p className="text-sm">
                  <span className="font-medium">变更：</span>
                  <span className="text-danger line-through">
                    {rollbackModal.record.old_value}
                  </span>{' '}
                  →{' '}
                  <span className="text-success font-medium">
                    {rollbackModal.record.new_value}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">操作人：</span>
                  {rollbackModal.record.operator}
                </p>
              </div>
            )}
            <p className="text-xs text-muted">
              回滚后将创建一条新的变更记录，此操作不可撤销。
            </p>
          </div>
        }
        confirmText="确认回滚"
        confirmVariant="danger"
        loading={rollbackLoading}
      />
    </div>
  )
}
