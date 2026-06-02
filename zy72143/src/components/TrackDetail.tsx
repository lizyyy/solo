import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import {
  Music,
  FileText,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  History,
} from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import AnomalyBadge from '@/components/AnomalyBadge'
import SuggestionBox from '@/components/SuggestionBox'
import AuditTimeline from '@/components/AuditTimeline'

const sourceLabels: Record<string, string> = {
  excel: 'Excel录入',
  contract: '合同录入',
  manual: '人工录入',
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-[#1e293b] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
        <Icon className="h-4 w-4 text-amber-400" />
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-200">{children}</span>
    </div>
  )
}

export default function TrackDetail() {
  const tracks = useStore((s) => s.tracks)
  const selectedTrackId = useStore((s) => s.selectedTrackId)
  const trackAuditLogs = useStore((s) => s.trackAuditLogs)
  const updateTrack = useStore((s) => s.updateTrack)

  const [noteText, setNoteText] = useState('')

  const track = tracks.find((t) => t.id === selectedTrackId) ?? null

  if (!track) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        请选择一条曲目查看详情
      </div>
    )
  }

  const isAuthExpired =
    track.auth_end_date !== null && new Date(track.auth_end_date) < new Date()

  function handleSaveNote() {
    if (!noteText.trim()) return
    updateTrack(track.id, { operatorNote: noteText.trim(), processedBy: '当前运营' })
    setNoteText('')
  }

  return (
    <div className="space-y-4">
      <Card title="基本信息" icon={Music}>
        <Field label="曲目名">{track.name}</Field>
        <Field label="版本">{track.version}</Field>
        <Field label="来源">{sourceLabels[track.source] || track.source}</Field>
        <Field label="音频路径">
          {track.audio_file_path ? (
            <span className="font-mono text-xs text-slate-400">{track.audio_file_path}</span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
      </Card>

      <Card title="授权信息" icon={FileText}>
        <Field label="合同编号">
          {track.contract_id ?? <span className="text-slate-500">—</span>}
        </Field>
        <Field label="授权期限">
          {track.auth_start_date && track.auth_end_date ? (
            <span className="flex items-center gap-2">
              {track.auth_start_date} ~ {track.auth_end_date}
              {isAuthExpired && (
                <span className="text-xs font-medium text-red-400">⚠ 授权已过期</span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
        <Field label="合同备注">
          {track.contract_note ?? <span className="text-slate-500">—</span>}
        </Field>
      </Card>

      <Card title="异常分析" icon={AlertTriangle}>
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-20 shrink-0 text-xs text-slate-500">异常类型</span>
          {track.anomaly_type && track.anomaly_type !== 'none' ? (
            <AnomalyBadge type={track.anomaly_type} />
          ) : (
            <span className="text-sm text-slate-500">无异常</span>
          )}
        </div>
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-20 shrink-0 text-xs text-slate-500">异常详情</span>
          <span className="text-sm text-slate-200">
            {track.anomaly_detail ?? <span className="text-slate-500">—</span>}
          </span>
        </div>
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-20 shrink-0 text-xs text-slate-500">处理状态</span>
          <StatusBadge status={track.status} />
        </div>
      </Card>

      <Card title="处理建议" icon={Lightbulb}>
        <SuggestionBox suggestion={track.processing_suggestion} />
      </Card>

      <Card title="操作备注" icon={MessageSquare}>
        {track.operator_note && (
          <div className="mb-3 rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300">
            {track.operator_note}
          </div>
        )}
        <div className="flex items-center gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="添加备注..."
            rows={2}
            className="flex-1 resize-none rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-500"
          />
          <button
            onClick={handleSaveNote}
            disabled={!noteText.trim()}
            className={cn(
              'self-end rounded px-4 py-2 text-sm font-medium transition-colors',
              noteText.trim()
                ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                : 'bg-slate-700/30 text-slate-600 cursor-not-allowed',
            )}
          >
            保存
          </button>
        </div>
      </Card>

      <Card title="操作历史" icon={History}>
        <AuditTimeline logs={trackAuditLogs} />
      </Card>
    </div>
  )
}
