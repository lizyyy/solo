import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Search, Download, RefreshCw } from 'lucide-react'
import { useRecordStore } from '@/store/recordStore'
import StatusBadge from '@/components/StatusBadge'
import { formatAmount, formatDate } from '@/lib/utils'
import type { RecordStatus } from '../../shared/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'returned', label: '已退回' },
  { value: 'suspended', label: '挂起' },
]

export default function RecordList() {
  const navigate = useNavigate()
  const { records, summary, filters, loading, fetchRecords, setFilters, exportCsv } =
    useRecordStore()

  useEffect(() => {
    fetchRecords()
  }, [filters.status, filters.start_date, filters.end_date, filters.min_amount, filters.max_amount, filters.search])

  const handleRowClick = (id: string) => {
    navigate(`/record/${id}`)
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-100">租赁保证金退回管理</h1>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-5">
            <p className="text-sm text-gray-400 mb-1">已确认金额</p>
            <p className="text-2xl font-mono font-semibold text-emerald-400">
              {formatAmount(summary.confirmed_total)}
            </p>
          </div>
          <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-5">
            <p className="text-sm text-gray-400 mb-1">挂起金额</p>
            <p className="text-2xl font-mono font-semibold text-red-400">
              {formatAmount(summary.suspended_total)}
            </p>
          </div>
          <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-5">
            <p className="text-sm text-gray-400 mb-1">记录总数</p>
            <p className="text-2xl font-mono font-semibold text-gray-200">
              {summary.total_count}
            </p>
          </div>
        </div>

        <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ status: opt.value })}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  filters.status === opt.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#12122a] text-gray-400 hover:text-gray-200 border border-[#2a2a4a]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ start_date: e.target.value })}
                className="bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-600"
              />
              <span className="text-gray-500 text-sm">至</span>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ end_date: e.target.value })}
                className="bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="最低金额"
                value={filters.min_amount}
                onChange={(e) => setFilters({ min_amount: e.target.value })}
                className="bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-1.5 text-sm text-gray-200 w-28 focus:outline-none focus:border-amber-600 font-mono"
              />
              <span className="text-gray-500 text-sm">—</span>
              <input
                type="number"
                placeholder="最高金额"
                value={filters.max_amount}
                onChange={(e) => setFilters({ max_amount: e.target.value })}
                className="bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-1.5 text-sm text-gray-200 w-28 focus:outline-none focus:border-amber-600 font-mono"
              />
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索单位名称或来源..."
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="w-full bg-[#12122a] border border-[#2a2a4a] rounded pl-9 pr-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRecords()}
                className="p-2 text-gray-400 hover:text-gray-200 border border-[#2a2a4a] rounded transition-colors"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#12122a] border border-[#2a2a4a] text-gray-400 hover:text-gray-200 rounded transition-colors"
              >
                <Download size={14} />
                导出
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a4a]">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">编号</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">退回单位</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">金额</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">状态</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">原始来源</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">最近处理时间</th>
                <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                    加载中...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                    暂无数据
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick(record.id)}
                    className={`border-b border-[#2a2a4a] hover:bg-[#2a2a4a]/30 cursor-pointer transition-colors ${
                      record.status === 'suspended' ? 'border-l-[3px] border-l-red-600' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">{record.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-200">{record.unit_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-200 font-mono text-right">
                      {formatAmount(record.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{record.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(record.updated_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(record.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-500 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
