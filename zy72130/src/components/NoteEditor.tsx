import { useState, useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { RevenueRecord } from '@/types'

export default function NoteEditor({ record }: { record: RevenueRecord }) {
  const { updateRecord, editingNoteId, setEditingNoteId } = useStore()
  const [value, setValue] = useState(record.currentNote)
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = editingNoteId === record.id

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setValue(record.currentNote)
  }, [record.currentNote])

  const handleSave = () => {
    if (value !== record.currentNote) {
      updateRecord(record.id, { currentNote: value })
    }
    setEditingNoteId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setValue(record.currentNote)
      setEditingNoteId(null)
    }
  }

  if (!isEditing) {
    return (
      <div
        onClick={() => setEditingNoteId(record.id)}
        className="cursor-pointer min-h-[24px] px-1.5 py-0.5 rounded border border-transparent
                   hover:border-neon/30 hover:bg-neon-glow transition-all duration-200
                   text-xs text-muted truncate max-w-[180px]"
        title={record.currentNote || '点击添加备注'}
      >
        {record.currentNote || <span className="text-muted/50">—</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="bg-surface-elevated border border-neon/50 rounded px-2 py-0.5
                   text-xs text-gray-200 w-[160px] focus:outline-none focus:shadow-neon-sm"
      />
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          handleSave()
        }}
        className="p-0.5 text-neon hover:bg-neon/10 rounded transition-colors"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault()
          setValue(record.currentNote)
          setEditingNoteId(null)
        }}
        className="p-0.5 text-muted hover:bg-danger/10 hover:text-danger rounded transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
