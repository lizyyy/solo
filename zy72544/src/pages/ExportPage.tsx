import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import {
  FileDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Clock,
  Link2,
  X,
} from 'lucide-react'
import type { ExportContent } from '@/types'

export default function ExportPage() {
  const records = useStore((s) => s.records)
  const exportSnapshots = useStore((s) => s.exportSnapshots)
  const regenerateExport = useStore((s) => s.regenerateExport)
  const navigate = useNavigate()

  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [selectedLeak, setSelectedLeak] = useState<ExportContent | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)

  const handleRegenerate = (recordId: string) => {
    setGenerating(recordId)
    setTimeout(() => {
      regenerateExport(recordId)
      setGenerating(null)
    }, 800)
  }

  return (
    <div className="p-8">
      {selectedLeak && (
        <LeakDetailModal leak={selectedLeak} onClose={() => setSelectedLeak(null)} onGoToLink={(url) => window.open(url, '_blank')} onGoToHistory={() => navigate('/history')} />
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-100">脱敏导出</h2>
        <p className="text-sm text-slate-500 mt-1">查看和重新生成脱敏导出，点开漏遮手机号查看保留理由</p>
      </div>

      <div className="space-y-4">
        {records.map((record) => {
          const snapshots = exportSnapshots
            .filter((e) => e.recordId === record.id)
            .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
          const latestSnapshot = snapshots[0]
          const isExpanded = expandedRecord === record.id

          return (
            <div key={record.id} className="bg-[#16162a] border border-slate-800 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-3">
                  <FileDown size={18} className="text-amber-400" />
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">{record.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {latestSnapshot ? (
                        <>
                          <span>版本 {latestSnapshot.version}</span>
                          <span>{new Date(latestSnapshot.generatedAt).toLocaleString('zh-CN')}</span>
                          <span>
                            漏遮 <strong className="text-red-400">{latestSnapshot.content.filter((c) => c.isLeaked).length}</strong>
                          </span>
                          <span>
                            知识库链接 <strong className="text-amber-400">{latestSnapshot.content[0]?.knowledgeLinks.length ?? 0}</strong>
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600">尚未生成导出</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRegenerate(record.id)
                    }}
                    disabled={generating === record.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw size={13} className={generating === record.id ? 'animate-spin' : ''} />
                    {generating === record.id ? '生成中...' : '重新生成'}
                  </button>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
              </div>

              {isExpanded && latestSnapshot && (
                <div className="border-t border-slate-800 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      导出内容 · 版本 {latestSnapshot.version} · {new Date(latestSnapshot.generatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>

                  {latestSnapshot.content.length === 0 ? (
                    <div className="text-center py-6 text-sm text-emerald-400">
                      <CheckCircle size={24} className="mx-auto mb-2 opacity-60" />
                      全部手机号已遮盖，无漏遮记录
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {latestSnapshot.content.map((item) => (
                        <div
                          key={item.phoneExposureId}
                          className={`rounded-lg p-3 border ${
                            item.isLeaked
                              ? 'bg-red-500/5 border-red-500/20 cursor-pointer hover:border-red-500/40'
                              : 'bg-emerald-500/5 border-emerald-500/10'
                          } transition-colors`}
                          onClick={() => item.isLeaked && setSelectedLeak(item)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {item.isLeaked ? (
                                <ShieldAlert size={14} className="text-red-400" />
                              ) : (
                                <CheckCircle size={14} className="text-emerald-400" />
                              )}
                              <span className={`font-mono text-sm ${item.isLeaked ? 'text-red-400' : 'text-emerald-400'}`}>
                                {item.maskedPhone}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                item.isLeaked ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {item.isLeaked ? '漏遮' : '已遮盖'}
                              </span>
                            </div>
                            {item.isLeaked && (
                              <span className="text-[10px] text-slate-600">
                                点击查看详情 →
                              </span>
                            )}
                          </div>
                          {item.isLeaked && (
                            <p className="text-xs text-slate-500 mt-2 pl-7">{item.retainReason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {snapshots.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-600">历史版本：{snapshots.length} 个</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeakDetailModal({
  leak,
  onClose,
  onGoToLink,
  onGoToHistory,
}: {
  leak: ExportContent
  onClose: () => void
  onGoToLink: (url: string) => void
  onGoToHistory: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a2e] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-400" />
            <h3 className="text-sm font-semibold text-slate-200">漏遮手机号详情</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-red-400 font-semibold">{leak.maskedPhone}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">漏遮</span>
          </div>

          <div className="space-y-3">
            <DetailRow label="保留理由" value={leak.retainReason} />
            <DetailRow label="缺少材料" value={leak.missingMaterials} />
            <DetailRow label="下一步" value={leak.nextStep} />
            <DetailRow label="指派给" value={leak.assignee} />
            <DetailRow label="参数版本" value={leak.paramVersion} mono />
            <DetailRow label="取舍理由" value={leak.tradeoffReason} />
          </div>

          {leak.knowledgeLinks.length > 0 && (
            <div>
              <span className="text-xs text-slate-500 block mb-2">关联知识库链接</span>
              <div className="space-y-1">
                {leak.knowledgeLinks.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => onGoToLink(url)}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-colors"
                  >
                    <Link2 size={12} />
                    <span className="truncate">{url}</span>
                    <ExternalLink size={10} className="shrink-0 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {leak.ticketNos.length > 0 && (
            <div>
              <span className="text-xs text-slate-500 block mb-2">关联工单</span>
              <div className="space-y-1">
                {leak.ticketNos.map((no, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-xs">
                    <AlertCircle size={12} className="text-amber-400" />
                    <span className="font-mono text-amber-400">{no}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onGoToHistory}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <Clock size={14} />
            查看此号码的变更历史
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-slate-500 block mb-0.5">{label}</span>
      <span className={`text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
