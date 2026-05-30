import { useState } from 'react'
import type { CustomerNote } from '@/types'
import { MessageSquare, Plus, Send } from 'lucide-react'

interface NotesPanelProps {
  notes: CustomerNote[]
  onAddNote: (content: string) => void
}

export default function NotesPanel({ notes, onAddNote }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('')

  const handleSubmit = () => {
    if (newNote.trim()) {
      onAddNote(newNote.trim())
      setNewNote('')
    }
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">客户备注</h3>
      </div>

      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
        {notes.map((note) => (
          <div key={note.id} className="bg-surface-700/40 rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-accent-blue font-medium">{note.author}</span>
              <span className="text-[10px] text-surface-500">{note.timestamp}</span>
            </div>
            <p className="text-xs text-surface-200 leading-relaxed">{note.content}</p>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-xs text-surface-400 text-center py-4">暂无备注</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="添加备注..."
          className="flex-1 bg-surface-700/60 border border-surface-600 rounded-lg px-3 py-2 text-xs text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-accent-blue/50 transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!newNote.trim()}
          className="w-8 h-8 rounded-lg bg-accent-blue/20 text-accent-blue flex items-center justify-center hover:bg-accent-blue/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
