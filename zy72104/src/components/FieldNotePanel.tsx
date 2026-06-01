import { useState } from 'react'
import { useStore } from '@/store'
import type { FieldNote } from '@/types'
import { Plus, Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

export default function FieldNotePanel() {
  const batchId = useStore((s) => s.currentBatchId)
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))
  const addNote = useStore((s) => s.addFieldNote)
  const removeNote = useStore((s) => s.removeFieldNote)
  const [expanded, setExpanded] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [newAuthor, setNewAuthor] = useState('')

  if (!batchId || !batch) return null

  const notes = batch.fieldNotes

  const handleAdd = () => {
    if (!newContent.trim()) return
    const note: FieldNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: newContent.trim(),
      noteTime: new Date().toISOString(),
      author: newAuthor.trim() || '未署名',
    }
    addNote(batchId, note)
    setNewContent('')
  }

  return (
    <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-[#a8d8ea] hover:bg-[#0f3460]/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-sm tracking-wide flex items-center gap-2">
          <MessageSquare size={14} /> 现场备注（原始保留）
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="space-y-2 mb-3">
            {notes.map((n) => (
              <div key={n.id} className="bg-[#1a1a2e] rounded border border-[#0f3460]/30 px-3 py-2 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-[#e2e8f0] whitespace-pre-wrap flex-1">{n.content}</p>
                  <button
                    onClick={() => removeNote(batchId, n.id)}
                    className="text-[#e94560]/40 hover:text-[#e94560] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#a8d8ea]/50">
                  <span>{new Date(n.noteTime).toLocaleString('zh-CN')}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#0f3460]/30">{n.author}</span>
                </div>
              </div>
            ))}
            {notes.length === 0 && (
              <p className="text-xs text-[#a8d8ea]/40 text-center py-3">暂无备注，设备巡检表的备注会原样保留</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-3 py-1.5 text-xs text-[#e2e8f0] flex-1 focus:outline-none focus:border-[#a8d8ea]/50"
              placeholder="输入现场备注，原样保留..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1.5 text-xs text-[#e2e8f0] w-16 focus:outline-none focus:border-[#a8d8ea]/50"
              placeholder="署名"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
            />
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0f3460] text-[#a8d8ea] text-xs hover:bg-[#0f3460]/80 transition-colors"
            >
              <Plus size={12} /> 添加
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
