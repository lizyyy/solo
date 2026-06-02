import { useState } from 'react'
import { MessageCircle, Plus, X } from 'lucide-react'
import type { ManualNote, TargetType } from '../types'
import { api } from '../services/api'

interface ManualNotesProps {
  targetType: TargetType
  targetId: string
  notes: ManualNote[]
  onNoteAdded?: (note: ManualNote) => void
}

export function ManualNotes({ targetType, targetId, notes, onNoteAdded }: ManualNotesProps) {
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const note = await api.createNote({
        target_type: targetType,
        target_id: targetId,
        content: content.trim(),
      })
      setContent('')
      setShowForm(false)
      onNoteAdded?.(note)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-primary-800 flex items-center gap-2">
          <MessageCircle size={18} className="text-accent-500" />
          人工备注
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-accent-600 hover:text-accent-700 flex items-center gap-1"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? '取消' : '添加备注'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="添加同事间的备注说明..."
            className="input mb-2 min-h-[80px] text-sm"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="btn-accent text-sm"
            >
              {submitting ? '提交中...' : '提交备注'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-thin">
        {notes.length === 0 ? (
          <p className="text-sm text-primary-400 text-center py-4">暂无备注</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-primary-50 rounded-lg p-3 border-l-4 border-accent-400"
            >
              <p className="text-sm text-primary-700 whitespace-pre-wrap">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-2 text-xs text-primary-500">
                <span>{note.created_by}</span>
                <span>{note.created_at.slice(0, 16)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
