import { useEffect } from "react"
import { useAppStore } from "@/store/useAppStore"
import { ThresholdBar } from "@/components/ThresholdBar"
import { RecordCard } from "@/components/RecordCard"
import { DataTable } from "@/components/DataTable"
import { ForceGauge } from "@/components/ForceGauge"
import { JudgmentTrace } from "@/components/JudgmentTrace"
import { downloadReport } from "@/utils/report"
import { Link } from "react-router-dom"
import { Anchor, Settings, Download, Trash2, Play } from "lucide-react"

export default function Dashboard() {
  const records = useAppStore((s) => s.records)
  const selectedRecordId = useAppStore((s) => s.selectedRecordId)
  const loadSampleData = useAppStore((s) => s.loadSampleData)
  const selectRecord = useAppStore((s) => s.selectRecord)
  const exportReport = useAppStore((s) => s.exportReport)
  const clearAll = useAppStore((s) => s.clearAll)

  useEffect(() => {
    if (records.length === 0) {
      loadSampleData()
    }
  }, [])

  const selectedRecord = records.find((r) => r.id === selectedRecordId)

  const handleExport = () => {
    const report = exportReport()
    downloadReport(report)
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-slate-100">
      <ThresholdBar />

      <div className="max-w-[1440px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Anchor className="w-6 h-6 text-[#FF6B35]" />
            <h1 className="text-xl font-bold text-slate-100">
              海上浮标系泊受力计算看板
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSampleData}
              disabled={records.length > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              加载样例
            </button>
            <button
              onClick={handleExport}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF6B35]/10 border border-[#FF6B35]/30 text-[#FF6B35] hover:bg-[#FF6B35]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              导出报告
            </button>
            <Link
              to="/threshold"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              阈值管理
            </Link>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清除
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <Anchor className="w-16 h-16 mb-4 text-slate-700" />
            <p className="text-lg mb-2">暂无数据</p>
            <p className="text-sm mb-6">点击"加载样例"按钮加载海上浮标系泊受力样例数据</p>
            <button
              onClick={loadSampleData}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 transition-colors"
            >
              <Play className="w-4 h-4" />
              加载样例数据
            </button>
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="w-80 flex-shrink-0 space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
              {records.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  isSelected={record.id === selectedRecordId}
                  onClick={() => selectRecord(record.id)}
                />
              ))}
            </div>

            {selectedRecord ? (
              <div className="flex-1 min-w-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <ForceGauge forceResult={selectedRecord.forceResult} />
                  </div>
                  <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <JudgmentTrace record={selectedRecord} />
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/30">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">采样数据明细</h3>
                  <DataTable record={selectedRecord} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                请从左侧选择一条记录查看详情
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
