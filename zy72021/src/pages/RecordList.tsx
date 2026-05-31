import { useState } from 'react'
import { useReconciliationStore } from '@/store/useReconciliationStore'
import { useNavigate } from 'react-router-dom'
import {
  FileUp,
  Download,
  Trash2,
  ChevronRight,
  Filter,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Swords,
} from 'lucide-react'
import type { ReconciliationStatus } from '@/types'
import { STATUS_LABELS } from '@/types'
import { ImportModal } from '@/components/ImportModal'

const STATUS_CONFIG: Record<
  ReconciliationStatus,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  matched: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-l-green-500',
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  },
  diff: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-l-amber-500',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  },
  pending: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-l-blue-500',
    icon: <HelpCircle className="w-4 h-4 text-blue-600" />,
  },
  overridden: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-l-purple-500',
    icon: <RotateCcw className="w-4 h-4 text-purple-600" />,
  },
  conflict: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-l-red-500',
    icon: <Swords className="w-4 h-4 text-red-600" />,
  },
}

export default function RecordList() {
  const { records, exportDiffReport, clearAll } = useReconciliationStore()
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<ReconciliationStatus | 'all'>(
    'all'
  )
  const [showImport, setShowImport] = useState(false)

  const filteredRecords =
    filterStatus === 'all'
      ? records
      : records.filter((r) => r.status === filterStatus)

  const statusCounts = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const handleExport = () => {
    const csv = exportDiffReport()
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `医保垫付差异报告_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatAmount = (v: number | null) =>
    v === null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-[#1a1a2e] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">
            连锁药房医保垫付 · 对账工具
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            交接前差异清单，一目了然
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded transition-colors"
          >
            <FileUp className="w-3.5 h-3.5" />
            导入数据
          </button>
          <button
            onClick={handleExport}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出差异报告
          </button>
          <button
            onClick={() => {
              if (window.confirm('确定清空所有对账记录？此操作不可恢复。')) {
                clearAll()
              }
            }}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-500 mr-1">筛选：</span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              filterStatus === 'all'
                ? 'bg-[#1a1a2e] text-white'
                : 'bg-white text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            全部 ({records.length})
          </button>
          {(Object.keys(STATUS_CONFIG) as ReconciliationStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  filterStatus === status
                    ? `${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].color} font-medium`
                    : 'bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {STATUS_CONFIG[status].icon}
                {STATUS_LABELS[status]} ({statusCounts[status] || 0})
              </button>
            )
          )}
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <FileUp className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {records.length === 0
                ? '尚未导入数据，点击右上角"导入数据"开始'
                : '当前筛选条件下无记录'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">药房名称</th>
                  <th className="px-4 py-3 font-medium">流水号</th>
                  <th className="px-4 py-3 font-medium text-right">
                    流水金额
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    合同金额
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    差异额
                  </th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const cfg = STATUS_CONFIG[record.status]
                  return (
                    <tr
                      key={record.id}
                      className={`border-t border-zinc-100 border-l-4 ${cfg.border} hover:bg-zinc-50 cursor-pointer transition-colors`}
                      onClick={() => navigate(`/detail/${record.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {record.pharmacyName || (
                          <span className="text-zinc-400 italic">
                            （空名称）
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 font-mono text-xs">
                        {record.flowNo}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatAmount(record.flowAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatAmount(record.contractAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {record.diffAmount !== null ? (
                          <span
                            className={
                              record.diffAmount !== 0
                                ? 'text-amber-700 font-semibold'
                                : 'text-zinc-500'
                            }
                          >
                            {record.diffAmount > 0 ? '+' : ''}
                            {formatAmount(record.diffAmount)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.icon}
                          {STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {record.source === 'flow'
                          ? '收款流水'
                          : record.source === 'contract'
                            ? '合同扫描件'
                            : '手动录入'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {records.length > 0 && (
          <div className="mt-3 flex justify-between text-xs text-zinc-400">
            <span>
              共 {records.length} 条记录，差异{' '}
              {records.filter(
                (r) => r.status === 'diff' || r.status === 'conflict'
              ).length}{' '}
              条，待确认 {records.filter((r) => r.status === 'pending').length}{' '}
              条
            </span>
            <span>
              已改判{' '}
              {records.filter((r) => r.status === 'overridden').length} 条
            </span>
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
