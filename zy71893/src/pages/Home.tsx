import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviationStore } from '@/store/useDeviationStore'
import { DEVIATION_TYPE_LABELS, RECORD_SOURCE_LABELS } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import StatCard from '@/components/StatCard'
import FilterBar from '@/components/FilterBar'
import AddRecordModal from '@/components/AddRecordModal'
import ImportModal from '@/components/ImportModal'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  Plus,
  Upload,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 10

export default function Home() {
  const navigate = useNavigate()
  const {
    getFilteredRecords,
    getStats,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    exportFilteredRecords,
    transitionStatus,
  } = useDeviationStore()

  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [page, setPage] = useState(1)

  const records = getFilteredRecords()
  const stats = getStats()

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const paginated = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const allSelected = paginated.length > 0 && paginated.every((r) => selectedIds.includes(r.id))

  const handleExport = () => {
    const csv = exportFilteredRecords()
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `锅炉燃烧偏差_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBatchPendingConfirmation = () => {
    for (const id of selectedIds) {
      transitionStatus(id, 'pending_confirmation', '批量标记为待确认')
    }
    clearSelection()
  }

  return (
    <div className="pl-16 lg:pl-56 min-h-screen">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">锅炉燃烧偏差记录</h1>
            <p className="text-sm text-slate-400 mt-1">设备组 · 当班维修工</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-iron-lighter hover:bg-iron-light text-slate-200 rounded-md text-sm transition-colors"
            >
              <Upload size={14} />
              导入
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-signal hover:bg-signal-dim text-white rounded-md text-sm transition-colors"
            >
              <Plus size={14} />
              新增
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<AlertTriangle size={20} />}
            label="待确认"
            value={stats.pendingConfirmation}
            accent="border-l-orange-500"
            delay={0}
          />
          <StatCard
            icon={<Clock size={20} />}
            label="待处理"
            value={stats.pendingProcessing}
            accent="border-l-yellow-500"
            delay={1}
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="已确认"
            value={stats.confirmed}
            accent="border-l-emerald-500"
            delay={2}
          />
          <StatCard
            icon={<Archive size={20} />}
            label="已关闭"
            value={stats.closed}
            delay={3}
          />
        </div>

        <div className="mb-4">
          <FilterBar />
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-signal/10 border border-signal/30 rounded-lg animate-slide-in-bottom">
            <span className="text-sm text-signal font-medium">已选 {selectedIds.length} 条</span>
            <button
              onClick={handleBatchPendingConfirmation}
              className="px-3 py-1 bg-orange-500/20 text-orange-300 text-sm rounded-md hover:bg-orange-500/30 transition-colors"
            >
              批量标记待确认
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 bg-iron-lighter text-slate-200 text-sm rounded-md hover:bg-iron-light transition-colors"
            >
              导出选中
            </button>
            <button
              onClick={clearSelection}
              className="text-slate-400 text-sm hover:text-white transition-colors ml-auto"
            >
              取消选择
            </button>
          </div>
        )}

        <div className="bg-slate-card rounded-lg border border-iron-lighter overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-iron-lighter">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => allSelected ? clearSelection() : selectAll(paginated.map((r) => r.id))}
                      className="rounded border-iron-lighter bg-slate-bg text-signal focus:ring-signal"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">编号</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">偏差类型</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">来源</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">设备</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">状态</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">创建人</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium">发现时间</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((record) => (
                  <tr
                    key={record.id}
                    className={`border-b border-iron-lighter/50 hover:bg-slate-hover transition-colors ${
                      selectedIds.includes(record.id) ? 'bg-slate-hover border-l-2 border-l-signal' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded border-iron-lighter bg-slate-bg text-signal focus:ring-signal"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-signal text-xs">{record.code}</td>
                    <td className="px-4 py-3 text-slate-200">{DEVIATION_TYPE_LABELS[record.deviationType]}</td>
                    <td className="px-4 py-3 text-slate-300">{RECORD_SOURCE_LABELS[record.source]}</td>
                    <td className="px-4 py-3 font-mono text-slate-300 text-xs">{record.equipmentCode}</td>
                    <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{record.createdBy}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{record.discoveredAt.replace('T', ' ').slice(0, 16)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/record/${record.id}`)}
                        className="text-slate-400 hover:text-signal transition-colors"
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">暂无匹配的偏差记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-iron-lighter">
              <span className="text-xs text-slate-400">
                共 {records.length} 条记录，第 {page}/{totalPages} 页
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-slate-hover disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-slate-hover disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-iron-lighter hover:bg-iron-light text-slate-300 rounded-md text-sm transition-colors"
          >
            <Download size={14} />
            导出当前筛选结果
          </button>
        </div>
      </div>

      <AddRecordModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  )
}
