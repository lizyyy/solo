import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { PracticeSession } from '@/types'

function SessionRow({
  session,
  onLoad,
  onDelete,
}: {
  session: PracticeSession
  onLoad: (id: string) => void
  onDelete: (id: string) => void
}) {
  const completed = !!session.completedAt
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-navy-800/60 border border-navy-600/30 hover:border-gold-500/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200 truncate">{session.batchName}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-500">{session.batchDate}</span>
          <span className="text-xs font-mono text-gold-500">
            {session.durationScore.toFixed(1)}分
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              completed
                ? 'bg-green-500/15 text-green-400'
                : 'bg-gold-500/15 text-gold-400'
            }`}
          >
            {completed ? '已完成' : '进行中'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!completed && (
          <button
            onClick={() => onLoad(session.id)}
            className="px-3 py-1 text-xs rounded-md bg-gold-500/15 text-gold-500 hover:bg-gold-500/25 transition-colors"
          >
            继续
          </button>
        )}
        <button
          onClick={() => onDelete(session.id)}
          className="px-2 py-1 text-xs rounded-md text-red-400 hover:bg-red-500/15 transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  )
}

export default function BatchSelector() {
  const sessions = useStore(s => s.sessions)
  const currentSession = useStore(s => s.currentSession)
  const createSession = useStore(s => s.createSession)
  const loadSession = useStore(s => s.loadSession)
  const deleteSession = useStore(s => s.deleteSession)
  const targetDuration = useStore(s => s.targetDuration)
  const setTargetDuration = useStore(s => s.setTargetDuration)
  const [open, setOpen] = useState(!currentSession)
  const [durationInput, setDurationInput] = useState(targetDuration.toString())

  if (!open && currentSession) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs rounded-lg bg-navy-800/80 border border-navy-600/40 text-gray-400 hover:text-gold-500 hover:border-gold-500/40 transition-colors"
      >
        📂 练习管理
      </button>
    )
  }

  const handleCreate = () => {
    const d = parseFloat(durationInput)
    if (isNaN(d) || d < 1 || d > 15) return
    setTargetDuration(d)
    createSession()
    setOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteSession(id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => currentSession && setOpen(false)}
      />
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl animate-slide-up"
        style={{
          background: 'linear-gradient(145deg, rgba(15,23,41,0.97), rgba(26,39,64,0.97))',
          border: '1px solid rgba(212,168,67,0.2)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 0 40px rgba(212,168,67,0.08)',
        }}
      >
        <div className="px-6 py-4 border-b border-navy-600/40">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">练习批次</h2>
            {currentSession && (
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-lg leading-none"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">目标久期</label>
              <input
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={durationInput}
                onChange={e => setDurationInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-navy-900/80 border border-navy-600/40 text-gray-200 font-mono text-sm focus:outline-none focus:border-gold-500/50 transition-colors"
              />
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #d4a843, #b8912e)',
                color: '#0f1729',
                boxShadow: '0 2px 12px rgba(212,168,67,0.3)',
              }}
            >
              新建练习
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sessions.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm">
                暂无练习记录，点击上方按钮开始
              </div>
            )}
            {sessions.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                onLoad={loadSession}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
