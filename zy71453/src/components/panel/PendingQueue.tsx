import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import type { AnomalyRecord } from '../../utils/types'

export default function PendingQueue() {
  const anomalies = useStore((s) => s.anomalies)
  const confirmAnomaly = useStore((s) => s.confirmAnomaly)
  const rejectAnomaly = useStore((s) => s.rejectAnomaly)
  const addNoteToAnomaly = useStore((s) => s.addNoteToAnomaly)

  const pending = useMemo(
    () => anomalies.filter((a) => a.status === 'pending'),
    [anomalies],
  )

  return (
    <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
      {pending.map((anomaly) => (
        <PendingCard
          key={anomaly.id}
          anomaly={anomaly}
          onConfirm={() => confirmAnomaly(anomaly.id, '管理员')}
          onReject={() => rejectAnomaly(anomaly.id, '管理员')}
          onNote={(note) => addNoteToAnomaly(anomaly.id, '管理员', note)}
        />
      ))}
      {pending.length === 0 && (
        <div className="py-4 text-center text-xs text-gray-500">暂无待确认异常</div>
      )}
    </div>
  )
}

function PendingCard({
  anomaly,
  onConfirm,
  onReject,
  onNote,
}: {
  anomaly: AnomalyRecord
  onConfirm: () => void
  onReject: () => void
  onNote: (note: string) => void
}) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')

  const handleSubmitNote = () => {
    if (noteText.trim()) {
      onNote(noteText.trim())
      setNoteText('')
      setShowNoteInput(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-[#111827] p-3 space-y-2">
      <p className="text-xs text-gray-200 leading-relaxed">{anomaly.description}</p>
      <p className="text-[10px] text-gray-500">
        来源: {anomaly.source.file} 行{anomaly.source.line}
      </p>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded px-3 py-1 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
        >
          确认
        </button>
        <button
          onClick={onReject}
          className="rounded px-3 py-1 text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
        >
          驳回
        </button>
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="rounded px-3 py-1 text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
        >
          备注
        </button>
      </div>

      {showNoteInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitNote()
            }}
            placeholder="输入备注内容..."
            className="flex-1 rounded border border-gray-600 bg-[#0a0e1a] px-2 py-1 text-xs text-gray-200 outline-none focus:border-[#00f0ff]"
            autoFocus
          />
          <button
            onClick={handleSubmitNote}
            className="rounded px-2 py-1 text-xs bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 transition-colors"
          >
            提交
          </button>
        </div>
      )}
    </div>
  )
}
