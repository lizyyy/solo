import { useState } from 'react'
import { useCubeStore } from '@/store/useCubeStore'
import { Download, FileJson, FileSpreadsheet, X } from 'lucide-react'

export default function ExportPanel() {
  const showExportPanel = useCubeStore(s => s.showExportPanel)
  const setShowExportPanel = useCubeStore(s => s.setShowExportPanel)
  const exportReport = useCubeStore(s => s.exportReport)
  const addDecision = useCubeStore(s => s.addDecision)
  const saveCurrentSnapshot = useCubeStore(s => s.saveCurrentSnapshot)

  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [snapshotName, setSnapshotName] = useState('')
  const [saving, setSaving] = useState(false)
  const [exported, setExported] = useState(false)

  if (!showExportPanel) return null

  const handleExport = () => {
    const report = exportReport()

    addDecision(`导出${format.toUpperCase()}报告`, `导出包含 ${report.summary.totalClaims} 笔赔付、${report.summary.anomalyCount} 条异常的报告`)

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loss-cube-report-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const headers = ['地区', '保额(万)', '赔付数', '赔付额(万)']
      const rows = report.regionBreakdown.map(r =>
        [r.regionName, r.insuredAmount / 10000, r.claimCount, r.claimAmount / 10000].join(',')
      )
      const anomalies = report.anomalies.map(a =>
        [a.type, a.sourceType, a.sourceId, a.severity, a.acknowledged ? '已确认' : '待确认', a.description].join(',')
      )
      const decisions = report.decisions.map(d =>
        [d.action, d.reason, d.operator, d.timestamp].join(',')
      )
      const csv = [
        '=== 地区汇总 ===',
        headers.join(','),
        ...rows,
        '',
        '=== 异常记录 ===',
        '类型,来源类型,来源ID,严重级别,状态,描述',
        ...anomalies,
        '',
        '=== 处理决策 ===',
        '操作,原因,操作人,时间',
        ...decisions,
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loss-cube-report-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  const handleSave = async () => {
    if (!snapshotName.trim()) return
    setSaving(true)
    try {
      await saveCurrentSnapshot(snapshotName.trim())
      addDecision('保存快照', `保存损失立方快照: ${snapshotName}`)
      setSnapshotName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed bottom-0 right-0 w-80 bg-[#0A1422]/95 backdrop-blur-xl border-t border-l border-[#1B3054] z-50 shadow-2xl shadow-black/40 rounded-tl-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3054]">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-[#00D4FF]" />
          <span className="text-sm font-semibold text-[#E0E8F0]">导出与保存</span>
        </div>
        <button
          onClick={() => setShowExportPanel(false)}
          className="text-[#5A6E8A] hover:text-[#E0E8F0] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <span className="text-[10px] text-[#7B8CA8] block mb-1.5">导出格式</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                format === 'json'
                  ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40'
                  : 'bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054]'
              }`}
            >
              <FileJson size={14} />
              JSON
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                format === 'csv'
                  ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40'
                  : 'bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054]'
              }`}
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
          </div>
        </div>

        <button
          onClick={handleExport}
          className={`w-full py-2 rounded text-xs font-medium transition-all ${
            exported
              ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'
              : 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40 hover:bg-[#00D4FF]/25'
          }`}
        >
          {exported ? '✓ 已导出' : '导出报告'}
        </button>

        <div className="border-t border-[#1B3054] pt-3">
          <span className="text-[10px] text-[#7B8CA8] block mb-1.5">保存快照到历史</span>
          <div className="flex gap-2">
            <input
              value={snapshotName}
              onChange={e => setSnapshotName(e.target.value)}
              placeholder="快照名称..."
              className="flex-1 bg-[#0D1B2E] border border-[#1B3054] text-[#E0E8F0] text-xs rounded px-2 py-1.5 focus:border-[#00D4FF] focus:outline-none placeholder:text-[#3A4A60]"
            />
            <button
              onClick={handleSave}
              disabled={saving || !snapshotName.trim()}
              className="px-3 py-1.5 rounded text-xs bg-[#00897B]/20 text-[#00E676] border border-[#00E676]/40 hover:bg-[#00897B]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? '...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
