import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate, downloadFile, exportToCSV } from '@/utils'
import { ArrowLeft, Clock, Download, FileJson, FileSpreadsheet, FileText, Save, RotateCcw, Check } from 'lucide-react'
import type { OperationHistory } from '@/types'

const opTypeMap: Record<string, string> = {
  add: '添加', update: '更新', delete: '删除', confirm: '确认', generate: '生成',
  auto_generate: '自动生成',
}
const targetTypeMap: Record<string, string> = {
  beat: '八拍', beat_marker: '八拍', cut: '剪辑点', cut_point: '剪辑点',
  note: '队形备注', formation_note: '队形备注', version: '版本', report: '报告',
}
const opColorMap: Record<string, string> = {
  add: 'bg-green-400', update: 'bg-blue-400', delete: 'bg-red-400',
  confirm: 'bg-emerald-400', generate: 'bg-purple-400', auto_generate: 'bg-purple-400',
}

export function HistoryExport() {
  const { id: projectId } = useParams<{ id: string }>()
  const projects = useStore((s) => s.projects)
  const operationHistory = useStore((s) => s.operationHistory)
  const beatMarkers = useStore((s) => s.beatMarkers)
  const cutPoints = useStore((s) => s.cutPoints)
  const formationNotes = useStore((s) => s.formationNotes)
  const rehearsalReports = useStore((s) => s.rehearsalReports)
  const versionSnapshots = useStore((s) => s.versionSnapshots)
  const createVersionSnapshot = useStore((s) => s.createVersionSnapshot)
  const addRehearsalReport = useStore((s) => s.addRehearsalReport)
  const confirmRehearsalReport = useStore((s) => s.confirmRehearsalReport)

  const project = projects.find((p) => p.id === projectId)
  const history = operationHistory.filter((o) => o.projectId === projectId).reverse()
  const snapshots = versionSnapshots.filter((v) => v.projectId === projectId).reverse()
  const reports = rehearsalReports.filter((r) => r.projectId === projectId).reverse()

  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportContent, setReportContent] = useState('')

  const pBeats = beatMarkers.filter((b) => b.projectId === projectId)
  const pCuts = cutPoints.filter((c) => c.projectId === projectId)
  const pNotes = formationNotes.filter((n) => n.projectId === projectId)

  const handleExportJSON = () => {
    try {
      const data = { beatMarkers: pBeats, cutPoints: pCuts, formationNotes: pNotes }
      downloadFile(JSON.stringify(data, null, 2), `${project?.name || 'project'}-markers.json`)
    } catch (e) {
      alert(`导出失败：${e instanceof Error ? e.message : '未知错误'}\n您可以尝试：1. 检查数据是否完整 2. 刷新页面后重试`)
    }
  }

  const handleExportCSV = () => {
    try {
      const beatCSV = exportToCSV(
        ['ID', '时间(秒)', '八拍号', 'BPM', '状态'],
        pBeats.map((b) => [b.id, String(b.timeSeconds), String(b.beatNumber), String(b.bpm), b.status]),
      )
      downloadFile(beatCSV, `${project?.name || 'project'}-beats.csv`, 'text/csv')

      const cutCSV = exportToCSV(
        ['ID', '开始时间', '结束时间', '标签', '状态'],
        pCuts.map((c) => [c.id, String(c.startTime), String(c.endTime), c.label, c.status]),
      )
      downloadFile(cutCSV, `${project?.name || 'project'}-cuts.csv`, 'text/csv')

      const noteCSV = exportToCSV(
        ['ID', '开始时间', '结束时间', '描述', '状态'],
        pNotes.map((n) => [n.id, String(n.startTime), String(n.endTime), n.description, n.status]),
      )
      downloadFile(noteCSV, `${project?.name || 'project'}-notes.csv`, 'text/csv')
    } catch (e) {
      alert(`导出失败：${e instanceof Error ? e.message : '未知错误'}\n您可以尝试：1. 检查数据是否完整 2. 刷新页面后重试`)
    }
  }

  const handleCreateSnapshot = () => {
    if (!snapshotLabel.trim() || !projectId) return
    try {
      createVersionSnapshot(projectId, snapshotLabel.trim())
      setSnapshotLabel('')
    } catch (e) {
      alert(`创建快照失败：${e instanceof Error ? e.message : '未知错误'}\n您可以尝试：1. 减少数据量 2. 刷新页面后重试`)
    }
  }

  const handleAddReport = () => {
    if (!reportTitle.trim() || !reportContent.trim() || !projectId) return
    addRehearsalReport(projectId, reportTitle.trim(), reportContent.trim())
    setReportTitle('')
    setReportContent('')
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/project/${projectId}`} className="btn-ghost flex items-center gap-2 text-sm">
          <ArrowLeft size={18} /> 返回
        </Link>
        <h1 className="text-xl font-bold text-white">{project?.name || '项目'} — 历史与导出</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-brand" /> 操作历史
          </h2>
          <div className="max-h-[60vh] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">暂无操作记录</p>
            ) : (
              history.map((op: OperationHistory) => (
                <div key={op.id} className="flex gap-3 py-2.5 border-l-2 border-surface-border pl-4 relative">
                  <span className={`absolute left-[-5px] top-3 w-2 h-2 rounded-full ${opColorMap[op.operationType] || 'bg-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                      <span>{formatDate(op.timestamp)}</span>
                      <span className="font-medium text-gray-300">
                        {opTypeMap[op.operationType] || op.operationType}
                      </span>
                      <span className="text-brand-light">{targetTypeMap[op.targetType] || op.targetType}</span>
                    </div>
                    <p className="text-sm text-gray-300 truncate">{op.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download size={18} className="text-gold" /> 导出标记
            </h2>
            <div className="flex gap-3">
              <button onClick={handleExportJSON} className="btn-gold flex items-center gap-2 text-sm">
                <FileJson size={16} /> 导出 JSON
              </button>
              <button onClick={handleExportCSV} className="btn-gold flex items-center gap-2 text-sm">
                <FileSpreadsheet size={16} /> 导出 CSV
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <RotateCcw size={18} className="text-brand-light" /> 版本快照
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="快照标签"
                className="input-field flex-1"
              />
              <button onClick={handleCreateSnapshot} className="btn-primary flex items-center gap-1 text-sm">
                <Save size={14} /> 创建快照
              </button>
            </div>
            {snapshots.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">暂无快照</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-surface border border-surface-border">
                    <span className="text-gray-300">{s.label}</span>
                    <span className="text-xs text-gray-500">{formatDate(s.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-brand-light" /> 排练报告
            </h2>
            <div className="space-y-2 mb-4">
              <input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="报告标题"
                className="input-field"
              />
              <textarea
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                placeholder="报告内容"
                className="input-field h-24 resize-none"
              />
              <button onClick={handleAddReport} className="btn-primary flex items-center gap-1 text-sm">
                <Save size={14} /> 保存报告
              </button>
            </div>
            {reports.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">暂无报告</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded bg-surface border border-surface-border">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm text-gray-300 truncate">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatDate(r.createdAt)}</span>
                      {r.status !== 'confirmed' && (
                        <button
                          onClick={() => confirmRehearsalReport(r.id)}
                          className="btn-ghost text-xs flex items-center gap-1 !text-status-confirmed !px-2 !py-1"
                        >
                          <Check size={12} /> 确认
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
