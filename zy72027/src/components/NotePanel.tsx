import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import type { SupplementaryNote, GameSession } from '@/types'
import { formatTimestamp } from '@/utils/timeUtils'

interface Props {
  session: GameSession
  onAddNote: (roundIndex: number, content: string, author: string) => void
}

export default function NotePanel({ session, onAddNote }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [newRound, setNewRound] = useState(1)
  const [newContent, setNewContent] = useState('')
  const [newAuthor, setNewAuthor] = useState('')

  const sortedNotes = [...session.notes].sort((a, b) => b.createdAt - a.createdAt)

  const handleSubmit = () => {
    if (!newContent.trim() || !newAuthor.trim()) return
    onAddNote(newRound, newContent.trim(), newAuthor.trim())
    setNewContent('')
    setNewAuthor('')
    setIsAdding(false)
  }

  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <FileText size={14} className="text-purple-400" />
          评分备注
        </h3>
        {session.status === 'ended' && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-xs font-medium transition-all"
          >
            <Plus size={12} />
            补录备注
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-[#1a1f4a]/60 rounded-lg p-3 space-y-2 border border-purple-800/30">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">回合</label>
              <input
                type="number"
                min={1}
                max={session.currentRound}
                value={newRound}
                onChange={e => setNewRound(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-800/60 border border-gray-700/40 rounded text-sm text-gray-200 focus:outline-none focus:border-purple-500/60"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">备注人</label>
              <input
                type="text"
                value={newAuthor}
                onChange={e => setNewAuthor(e.target.value)}
                placeholder="如：王老师"
                className="w-full px-2 py-1.5 bg-gray-800/60 border border-gray-700/40 rounded text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">备注内容</label>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="输入评分备注..."
              rows={2}
              className="w-full px-2 py-1.5 bg-gray-800/60 border border-gray-700/40 rounded text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1 rounded bg-purple-600/60 hover:bg-purple-500/60 text-white text-xs font-medium"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {sortedNotes.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">暂无备注</p>
      ) : (
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {sortedNotes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteCard({ note }: { note: SupplementaryNote }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${
      note.isSupplementary
        ? 'bg-amber-900/20 border-amber-700/30'
        : 'bg-purple-900/20 border-purple-700/30'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            note.isSupplementary
              ? 'bg-amber-800/40 text-amber-300'
              : 'bg-purple-800/40 text-purple-300'
          }`}>
            {note.isSupplementary ? '补录' : '原始'}
          </span>
          <span className="text-xs text-gray-400">第{note.roundIndex}回合</span>
        </div>
        <span className="text-[10px] text-gray-600">{note.author}</span>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{note.content}</p>
      <p className="text-[10px] text-gray-600 mt-1">{formatTimestamp(note.createdAt)}</p>
    </div>
  )
}
