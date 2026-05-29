import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { StatusBadge, ConflictBadge } from '@/components/StatusBadge'
import { formatTime, formatDate } from '@/utils'
import { Play, Pause, SkipForward, Music, Scissors, Users, AlertTriangle, Edit, ArrowLeft, Clock } from 'lucide-react'
import type { ConfirmStatus } from '@/types'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const projects = useStore((s) => s.projects)
  const audioFiles = useStore((s) => s.audioFiles)
  const beatMarkers = useStore((s) => s.beatMarkers)
  const cutPoints = useStore((s) => s.cutPoints)
  const formationNotes = useStore((s) => s.formationNotes)
  const conflicts = useStore((s) => s.conflicts)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0.35)

  const project = projects.find((p) => p.id === id)
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle size={48} className="text-status-conflict" />
        <p className="text-lg text-gray-300">未找到该项目</p>
        <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> 返回列表</Link>
      </div>
    )
  }

  const audio = audioFiles.filter((a) => a.projectId === id)
  const markers = beatMarkers.filter((b) => b.projectId === id).sort((a, b) => a.timeSeconds - b.timeSeconds)
  const cuts = cutPoints.filter((c) => c.projectId === id)
  const notes = formationNotes.filter((f) => f.projectId === id)
  const projConflicts = conflicts.filter((c) => c.projectId === id)
  const mainAudio = audio[0]

  const rate = (list: { status: ConfirmStatus }[], target: ConfirmStatus) => {
    if (!list.length) return 0
    return Math.round((list.filter((i) => i.status === target).length / list.length) * 100)
  }

  const avgBpm = markers.length ? Math.round(markers.reduce((s, m) => s + m.bpm, 0) / markers.length) : 0

  const ring = (label: string, value: number, color: string) => (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2A3A5C" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${value} ${100 - value}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white">{value}%</span>
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-ghost px-2 py-1"><ArrowLeft size={18} /></Link>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/project/${id}/edit`} className="btn-ghost flex items-center gap-1"><Edit size={15} /> 编辑</Link>
          <Link to={`/project/${id}/compare`} className="btn-ghost flex items-center gap-1"><Users size={15} /> 对比</Link>
          <Link to={`/project/${id}/history`} className="btn-ghost flex items-center gap-1"><Clock size={15} /> 历史</Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3"><Music size={18} className="text-brand-light" /><h2 className="text-lg font-semibold text-white">音频播放器</h2></div>
        {mainAudio ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setPlaying(!playing)} className="w-10 h-10 rounded-full bg-brand flex items-center justify-center hover:bg-brand-light transition">
                {playing ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
              </button>
              <button className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center hover:bg-surface-border transition">
                <SkipForward size={14} className="text-gray-300" />
              </button>
              <div className="flex-1">
                <div className="h-2 bg-surface-border rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setProgress((e.clientX - r.left) / r.width); }}>
                  <div className="h-full bg-gradient-to-r from-brand to-brand-light rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
              <span className="text-xs font-mono text-gray-400">{formatTime(progress * mainAudio.duration)} / {formatTime(mainAudio.duration)}</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>文件：{mainAudio.fileName}</span>
              <span>采样率：{mainAudio.sampleRate}Hz</span>
              <span>上传：{formatDate(mainAudio.uploadedAt)}</span>
              <StatusBadge status={mainAudio.status} />
            </div>
          </div>
        ) : <p className="text-gray-500 text-sm">暂无音频文件</p>}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Music size={18} className="text-gold" /><h2 className="text-lg font-semibold text-white">节拍时间线</h2></div>
          {avgBpm > 0 && <span className="text-sm font-mono text-gold">BPM: {avgBpm}</span>}
        </div>
        {markers.length > 0 ? (
          <div className="relative h-24 bg-surface rounded-lg border border-surface-border overflow-x-auto">
            <div className="relative h-full min-w-[600px]">
              {markers.map((m) => {
                const maxTime = markers[markers.length - 1].timeSeconds || 1
                const left = (m.timeSeconds / maxTime) * 100
                return (
                  <div key={m.id} className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${left}%` }}>
                    <div className={`w-0.5 flex-1 ${m.status === 'confirmed' ? 'bg-gold' : m.status === 'conflict' ? 'bg-status-conflict' : 'border-l border-dashed border-status-temporary'}`} />
                    <span className="text-[10px] font-mono text-gray-400 mt-1 whitespace-nowrap">#{m.beatNumber}</span>
                    <span className="text-[10px] font-mono text-gray-500">{formatTime(m.timeSeconds)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : <p className="text-gray-500 text-sm">暂无节拍标记</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center gap-2 mb-3"><Users size={18} className="text-brand-light" /><h2 className="text-lg font-semibold text-white">队形备注</h2></div>
          {notes.length > 0 ? (
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{n.description}</p>
                    <p className="text-xs font-mono text-gray-400">{formatTime(n.startTime)} → {formatTime(n.endTime)}</p>
                  </div>
                  <StatusBadge status={n.status} />
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500 text-sm">暂无队形备注</p>}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3"><Scissors size={18} className="text-gold" /><h2 className="text-lg font-semibold text-white">剪辑点</h2></div>
          {cuts.length > 0 ? (
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {cuts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface border border-surface-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{c.label} {c.hasOverlap && <AlertTriangle size={12} className="inline text-status-conflict" />}</p>
                    <p className="text-xs font-mono text-gray-400">{formatTime(c.startTime)} → {formatTime(c.endTime)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500 text-sm">暂无剪辑点</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">确认率仪表盘</h2>
        <div className="flex justify-around">
          {ring('节拍', rate(markers, 'confirmed'), '#D4A843')}
          {ring('剪辑', rate(cuts, 'confirmed'), '#8B2252')}
          {ring('队形', rate(notes, 'confirmed'), '#B84479')}
          {ring('音频', rate(audio, 'confirmed'), '#4ADE80')}
        </div>
      </div>

      {projConflicts.length > 0 && (
        <div className="card border-status-conflict/30">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} className="text-status-conflict" /><h2 className="text-lg font-semibold text-white">冲突警告</h2></div>
          <ul className="space-y-2">
            {projConflicts.map((c) => (
              <li key={c.id} className="p-3 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-2 mb-1"><ConflictBadge type={c.type} /><span className={`text-xs font-mono ${c.severity === 'error' ? 'text-status-conflict' : 'text-status-temporary'}`}>{c.severity === 'error' ? '严重' : '警告'}</span></div>
                <p className="text-sm text-gray-300">{c.message}</p>
                <p className="text-xs text-gray-500 mt-1">💡 {c.suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
