import { useState, useEffect } from 'react'
import { Play, Copy, Download } from 'lucide-react'
import { useStore } from '../store'
import SummaryPanel from '../components/SummaryPanel'
import ConflictCard from '../components/ConflictCard'
import NoiseRiskCard from '../components/NoiseRiskCard'
import AdjacencyDiagram from '../components/AdjacencyDiagram'
import ReportHistory from '../components/ReportHistory'

export default function DetectPage() {
  const {
    conflicts, noiseRisks, reports, loading,
    detectConflicts, detectNoiseAdjacency,
    updateReservation, fetchReports, saveReport, exportNotification,
  } = useStore()

  const [reportName, setReportName] = useState('')
  const [notificationText, setNotificationText] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  const pendingCount = conflicts.filter((c) => c.status === 'pending').length + noiseRisks.filter((r) => r.status === 'pending').length

  const handleDetect = async () => {
    await Promise.all([detectConflicts(), detectNoiseAdjacency()])
  }

  const handleResolveConflict = async (reservationIds: number[]) => {
    for (const id of reservationIds) {
      await updateReservation(id, { status: 'normal' })
    }
    await detectConflicts()
  }

  const handleResolveNoise = async (reservationIds: number[]) => {
    for (const id of reservationIds) {
      await updateReservation(id, { status: 'normal' })
    }
    await detectNoiseAdjacency()
  }

  const generateNotification = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toTimeString().slice(0, 5)

    let text = '琴房排班检测报告\n'
    text += `检测时间: ${dateStr} ${timeStr}\n`
    text += `时段冲突: ${conflicts.length} 项\n`
    text += `邻接风险: ${noiseRisks.length} 项\n\n`

    text += '【时段冲突】\n'
    if (conflicts.length === 0) {
      text += '- 无\n'
    } else {
      for (const c of conflicts) {
        text += `- ${c.room} ${c.date} ${c.timeSlot}: ${c.description}\n`
      }
    }

    text += '\n【邻接风险】\n'
    if (noiseRisks.length === 0) {
      text += '- 无\n'
    } else {
      for (const r of noiseRisks) {
        const riskLabel = r.combinedRisk === 'high' ? '高风险' : r.combinedRisk === 'medium' ? '中风险' : '低风险'
        text += `- ${r.roomA} ↔ ${r.roomB} ${r.date} ${r.timeSlot}: ${riskLabel}, ${r.suggestion}\n`
      }
    }

    setNotificationText(text)
    return text
  }

  const handleCopyNotification = () => {
    const text = notificationText || generateNotification()
    navigator.clipboard.writeText(text)
  }

  const handleExportNotification = () => {
    if (!notificationText) generateNotification()
    exportNotification()
  }

  const handleSaveReport = async () => {
    if (!reportName.trim()) return
    await saveReport({
      name: reportName.trim(),
      conflictCount: conflicts.length,
      adjacencyRiskCount: noiseRisks.length,
      details: notificationText || generateNotification(),
    })
    setReportName('')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">检测分析</h2>
        <button
          onClick={handleDetect}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-brand-900 font-medium rounded transition-colors text-sm"
        >
          <Play size={16} />
          {loading ? '检测中...' : '执行检测'}
        </button>
      </div>

      <SummaryPanel
        conflictCount={conflicts.length}
        adjacencyRiskCount={noiseRisks.length}
        pendingCount={pendingCount}
      />

      <div>
        <h3 className="text-sm font-medium text-brand-200 mb-3">时段冲突 ({conflicts.length})</h3>
        {conflicts.length === 0 ? (
          <div className="bg-brand-800 rounded-lg p-4 border border-brand-700 text-brand-400 text-sm text-center">暂无冲突</div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((c, i) => (
              <ConflictCard key={i} conflict={c} onResolve={() => handleResolveConflict(c.reservationIds)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-brand-200 mb-3">邻接风险 ({noiseRisks.length})</h3>
        <AdjacencyDiagram />
        {noiseRisks.length === 0 ? (
          <div className="bg-brand-800 rounded-lg p-4 border border-brand-700 text-brand-400 text-sm text-center mt-3">暂无邻接风险</div>
        ) : (
          <div className="space-y-3 mt-3">
            {noiseRisks.map((r, i) => (
              <NoiseRiskCard key={i} risk={r} onResolve={() => handleResolveNoise(r.reservationIds)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-brand-200 mb-3">通知导出</h3>
        <div className="bg-brand-800 rounded-lg border border-brand-700 p-4 space-y-3">
          <textarea
            className="w-full h-48 bg-brand-900 border border-brand-600 text-brand-100 text-sm rounded p-3 mono focus:outline-none focus:border-amber-400 resize-y"
            value={notificationText}
            onChange={(e) => setNotificationText(e.target.value)}
            placeholder="点击下方按钮生成通知文本..."
            readOnly={false}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={generateNotification}
              className="text-xs px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded transition-colors"
            >
              生成通知
            </button>
            <button
              onClick={handleCopyNotification}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded transition-colors"
            >
              <Copy size={12} />
              复制
            </button>
            <button
              onClick={handleExportNotification}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-brand-200 rounded transition-colors"
            >
              <Download size={12} />
              导出文件
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-brand-200 mb-3">报告保存</h3>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="输入报告名称"
            className="flex-1 bg-brand-800 border border-brand-600 text-brand-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={handleSaveReport}
            disabled={!reportName.trim() || conflicts.length === 0 && noiseRisks.length === 0}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-brand-900 font-medium rounded transition-colors"
          >
            保存报告
          </button>
        </div>
        <ReportHistory reports={reports} />
      </div>
    </div>
  )
}
