import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { Download, FileText, Copy, Check } from 'lucide-react'
import { generateExportContent, computeSettlement } from '@/utils/exportUtils'
import type { ExportFormat, GameSession } from '@/types'

export default function Export() {
  const navigate = useNavigate()
  const { sessions, getSettlement } = useGameStore()

  const endedSessions = useMemo(() => sessions.filter(s => s.status === 'ended'), [sessions])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(endedSessions.map(s => s.id)))
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [copied, setCopied] = useState(false)

  const selectedSessions = useMemo(
    () => endedSessions.filter(s => selectedIds.has(s.id)),
    [endedSessions, selectedIds]
  )

  const settlements = useMemo(
    () => selectedSessions.map(s => getSettlement(s.id) || computeSettlement(s)),
    [selectedSessions, getSettlement]
  )

  const content = useMemo(
    () => generateExportContent(selectedSessions, settlements, format),
    [selectedSessions, settlements, format]
  )

  const toggleSession = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = format === 'markdown' ? 'md' : 'txt'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `量子音符弹幕-成绩报告.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (endedSessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-lg text-gray-500">暂无可导出的游戏记录</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-purple-600/60 hover:bg-purple-500/60 text-white text-sm font-medium">
            前往操控台
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-purple-300">导出中心</h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="space-y-4">
          <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">选择局次</h3>
            {endedSessions.map(s => (
              <label
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700/30 cursor-pointer hover:border-purple-700/40 transition-all"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggleSession(s.id)}
                  className="accent-purple-500"
                />
                <span className="text-xs text-gray-300">{s.levelParams.name}</span>
                <span className="text-[10px] text-gray-600 ml-auto">
                  {s.currentRound}回合
                </span>
              </label>
            ))}
          </div>

          <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">导出格式</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'markdown'}
                  onChange={() => setFormat('markdown')}
                  className="accent-purple-500"
                />
                <FileText size={14} className="text-gray-400" />
                <span className="text-xs text-gray-300">Markdown (.md)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 'text'}
                  onChange={() => setFormat('text')}
                  className="accent-purple-500"
                />
                <FileText size={14} className="text-gray-400" />
                <span className="text-xs text-gray-300">纯文本 (.txt)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 text-sm font-medium transition-all"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-purple-600/60 hover:bg-purple-500/60 text-white text-sm font-medium transition-all shadow-[0_0_12px_rgba(139,92,246,0.2)]"
            >
              <Download size={14} />
              下载
            </button>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 h-full">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">预览</h3>
            <pre className="bg-[#080b1f] rounded-lg p-4 text-xs text-gray-300 leading-relaxed overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
