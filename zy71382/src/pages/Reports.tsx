import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, RotateCcw, ChevronRight, FileText, Download, Plus, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SupplementDrawer from '@/components/reports/SupplementDrawer'

const statusConfig = {
  processed: {
    icon: CheckCircle,
    color: '#00D9A6',
    bg: 'bg-[#00D9A6]/10',
    border: 'border-[#00D9A6]/20',
    label: '已处理',
  },
  pending: {
    icon: Clock,
    color: '#F5A623',
    bg: 'bg-[#F5A623]/10',
    border: 'border-[#F5A623]/20',
    label: '待确认',
  },
  returned: {
    icon: RotateCcw,
    color: '#E74C3C',
    bg: 'bg-[#E74C3C]/10',
    border: 'border-[#E74C3C]/20',
    label: '需退回补材料',
  },
}

export default function ReportBoard() {
  const reports = useStore((s) => s.reports)
  const reportRecords = useStore((s) => s.reportRecords)
  const clusters = useStore((s) => s.clusters)
  const warnings = useStore((s) => s.qualityWarnings)
  const withdrawReport = useStore((s) => s.withdrawReport)
  const updateReportRecordStatus = useStore((s) => s.updateReportRecordStatus)
  const exportReport = useStore((s) => s.exportReport)
  const addToast = useStore((s) => s.addToast)
  const createReport = useStore((s) => s.createReport)
  const navigate = useNavigate()

  const [drawerRecordId, setDrawerRecordId] = useState<string | null>(null)
  const [showNewReport, setShowNewReport] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const activeReport = reports.find((r) => r.status === 'submitted') || reports[0]

  if (!activeReport) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <FileText className="w-12 h-12 text-[#2a3a4d] mb-4" />
        <p className="text-sm text-[#6b7f94] mb-4">暂无报告</p>
        <button
          onClick={() => setShowNewReport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-[#00D9A6] text-[#0F1419] text-xs font-medium hover:bg-[#00D9A6]/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          创建报告
        </button>
      </div>
    )
  }

  const records = reportRecords.filter((r) => r.report_id === activeReport.id)
  const processed = records.filter((r) => r.record_status === 'processed')
  const pending = records.filter((r) => r.record_status === 'pending')
  const returned = records.filter((r) => r.record_status === 'returned')

  const columns = [
    { key: 'processed' as const, items: processed, config: statusConfig.processed },
    { key: 'pending' as const, items: pending, config: statusConfig.pending },
    { key: 'returned' as const, items: returned, config: statusConfig.returned },
  ]

  const handleCreateReport = () => {
    if (!newTitle.trim()) return
    createReport(newTitle.trim())
    setNewTitle('')
    setShowNewReport(false)
  }

  const handleExport = (format: 'markdown' | 'json') => {
    const content = exportReport(activeReport.id, format)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeReport.title}.${format === 'json' ? 'json' : 'md'}`
    a.click()
    URL.revokeObjectURL(url)
    addToast(`报告已导出为 ${format.toUpperCase()}`, 'success')
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-['DM_Sans']">报告管理</h1>
          <p className="text-xs text-[#6b7f94] mt-0.5">{activeReport.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewReport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] bg-[#00D9A6] text-[#0F1419] font-medium hover:bg-[#00D9A6]/80 transition-colors"
          >
            <Plus className="w-3 h-3" />
            新建报告
          </button>
          {activeReport.status === 'submitted' && (
            <button
              onClick={() => withdrawReport(activeReport.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-[#F5A623]/30 text-[#F5A623] hover:bg-[#F5A623]/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              撤回
            </button>
          )}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border border-[#1e2a36] text-[#6b7f94] hover:text-white hover:border-[#2a3a4d] transition-colors">
              <Download className="w-3 h-3" />
              导出
            </button>
            <div className="absolute right-0 top-full mt-1 bg-[#1a2332] border border-[#2a3a4d] rounded shadow-xl py-1 hidden group-hover:block z-10 min-w-32">
              <button
                onClick={() => handleExport('markdown')}
                className="w-full px-3 py-1.5 text-left text-[11px] text-[#c8d6e5] hover:bg-[#2a3a4d] transition-colors"
              >
                Markdown
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-3 py-1.5 text-left text-[11px] text-[#c8d6e5] hover:bg-[#2a3a4d] transition-colors"
              >
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewReport && (
        <div className="bg-[#141b22] rounded-lg border border-[#00D9A6]/30 p-4 flex items-center gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="报告标题"
            className="flex-1 bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-2 text-xs text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateReport()}
            autoFocus
          />
          <button
            onClick={handleCreateReport}
            className="px-4 py-2 rounded text-[11px] bg-[#00D9A6] text-[#0F1419] font-medium hover:bg-[#00D9A6]/80 transition-colors"
          >
            创建
          </button>
          <button
            onClick={() => { setShowNewReport(false); setNewTitle('') }}
            className="px-4 py-2 rounded text-[11px] text-[#6b7f94] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => {
          const Icon = col.config.icon
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" style={{ color: col.config.color }} />
                  <span className="text-xs font-semibold" style={{ color: col.config.color }}>
                    {col.config.label}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono']"
                    style={{ backgroundColor: `${col.config.color}15`, color: col.config.color }}
                  >
                    {col.items.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {col.items.map((record) => {
                    const cluster = clusters.find((c) => c.id === record.cluster_id)
                    if (!cluster) return null
                    const clusterWarnings = warnings.filter((w) => w.cluster_id === cluster.id)

                    return (
                      <motion.div
                        key={record.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-lg border p-3 cursor-pointer transition-all hover:brightness-110 ${col.config.bg} ${col.config.border}`}
                        onClick={() => navigate(`/cluster/${cluster.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-[11px] font-['JetBrains_Mono'] text-[#8b9db3] truncate flex-1 leading-relaxed">
                            {cluster.sql_summary.slice(0, 50)}
                          </p>
                          <ChevronRight className="w-3 h-3 text-[#4a5f75] shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-[#6b7f94]">频次 {cluster.count}</span>
                          <span className="text-[#4a5f75]">·</span>
                          <span className="text-[#6b7f94]">
                            {cluster.avg_exec_time_ms >= 1000
                              ? `${(cluster.avg_exec_time_ms / 1000).toFixed(1)}s`
                              : `${cluster.avg_exec_time_ms}ms`}
                          </span>
                          {clusterWarnings.length > 0 && (
                            <>
                              <span className="text-[#4a5f75]">·</span>
                              <span className="flex items-center gap-0.5 text-[#F5A623]">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {clusterWarnings.length}
                              </span>
                            </>
                          )}
                        </div>
                        {record.record_status === 'returned' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDrawerRecordId(record.id)
                            }}
                            className="mt-2 w-full py-1.5 rounded text-[11px] text-center border border-dashed border-[#E74C3C]/40 text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors"
                          >
                            补录材料
                          </button>
                        )}
                        {record.record_status === 'pending' && record.reviewed_by && (
                          <p className="mt-1.5 text-[10px] text-[#6b7f94]">
                            退回补录后重新提交 · {record.reviewed_by}
                          </p>
                        )}
                        {record.record_status === 'processed' && record.reviewed_by && (
                          <p className="mt-1.5 text-[10px] text-[#4a5f75]">
                            确认人: {record.reviewed_by}
                          </p>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>

      <SupplementDrawer
        recordId={drawerRecordId}
        onClose={() => setDrawerRecordId(null)}
      />
    </div>
  )
}
