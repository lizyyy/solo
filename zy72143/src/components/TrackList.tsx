import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import AnomalyBadge from '@/components/AnomalyBadge'

function getAuthStatus(track: { contract_id: string | null; auth_end_date: string | null }) {
  if (!track.contract_id) return { label: '未录入', className: 'text-slate-500' }
  if (track.auth_end_date && new Date(track.auth_end_date) < new Date()) {
    return { label: '已过期', className: 'text-red-400' }
  }
  return { label: '已授权', className: 'text-emerald-400' }
}

export default function TrackList() {
  const tracks = useStore((s) => s.tracks)
  const selectedTrackId = useStore((s) => s.selectedTrackId)
  const selectTrack = useStore((s) => s.selectTrack)
  const updateTrack = useStore((s) => s.updateTrack)
  const [noteTrackId, setNoteTrackId] = useState<number | null>(null)
  const [noteValue, setNoteValue] = useState('')

  if (tracks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        暂无曲目数据
      </div>
    )
  }

  function handleNoteSubmit(id: number) {
    if (!noteValue.trim()) return
    updateTrack(id, { operatorNote: noteValue.trim(), processedBy: '当前运营' })
    setNoteTrackId(null)
    setNoteValue('')
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 text-xs text-slate-400">
            <th className="px-4 py-3 font-medium">曲目名</th>
            <th className="px-4 py-3 font-medium">版本</th>
            <th className="px-4 py-3 font-medium">授权状态</th>
            <th className="px-4 py-3 font-medium">异常类型</th>
            <th className="px-4 py-3 font-medium">处理状态</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => {
            const isSelected = track.id === selectedTrackId
            const auth = getAuthStatus(track)

            return (
              <tr
                key={track.id}
                onClick={() => selectTrack(track.id)}
                tabIndex={0}
                aria-label={`${track.name} ${track.version}`}
                className={cn(
                  'cursor-pointer border-b border-slate-800/50 transition-colors',
                  isSelected
                    ? 'border-l-2 border-l-amber-500 bg-amber-500/5'
                    : 'border-l-2 border-l-transparent hover:bg-slate-800/30',
                )}
              >
                <td className="px-4 py-3 font-medium text-slate-200">{track.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                    {track.version}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs', auth.className)}>{auth.label}</span>
                </td>
                <td className="px-4 py-3">
                  <AnomalyBadge type={track.anomaly_type} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={track.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => updateTrack(track.id, { status: 'passed', processedBy: '当前运营' })}
                      className="rounded bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => updateTrack(track.id, { status: 'needs_review', processedBy: '当前运营' })}
                      className="rounded bg-amber-600/20 px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-600/30"
                    >
                      需确认
                    </button>
                    {noteTrackId === track.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleNoteSubmit(track.id)}
                          placeholder="输入备注..."
                          className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-amber-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleNoteSubmit(track.id)}
                          className="rounded bg-sky-600/20 px-2 py-1 text-xs text-sky-400 hover:bg-sky-600/30"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => { setNoteTrackId(null); setNoteValue('') }}
                          className="rounded bg-slate-600/20 px-2 py-1 text-xs text-slate-400 hover:bg-slate-600/30"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNoteTrackId(track.id); setNoteValue(track.operator_note || '') }}
                        className="rounded bg-slate-600/20 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600/30"
                      >
                        备注
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
