import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { X, MessageSquarePlus } from 'lucide-react'

interface Props {
  operationId: string | undefined
  onClose: () => void
}

export function SupplementNoteModal({ operationId, onClose }: Props) {
  const [content, setContent] = useState('')
  const [addedBy, setAddedBy] = useState('科普馆讲解员-小夏')
  const { addSupplementNote } = useGameStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    addSupplementNote(operationId, content.trim(), addedBy.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-paper-cream text-charcoal p-6 w-full max-w-md border-2 border-warning-orange"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono font-bold text-lg flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-warning-orange" />
            补录备注
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">补录人</label>
            <input
              type="text"
              value={addedBy}
              onChange={e => setAddedBy(e.target.value)}
              className="w-full px-3 py-2 border-2 border-charcoal/20 bg-white text-charcoal 
                font-mono text-sm focus:outline-none focus:border-warning-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">备注内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="请输入补录的备注内容，将与原始记录一起导出..."
              rows={4}
              className="w-full px-3 py-2 border-2 border-charcoal/20 bg-white text-charcoal 
                font-mono text-sm focus:outline-none focus:border-warning-orange resize-none"
              autoFocus
            />
          </div>

          <div className="bg-warning-orange/10 border border-warning-orange/30 p-3 text-xs">
            <p className="font-medium text-warning-orange mb-1">💡 补录说明</p>
            <p className="text-charcoal/70">
              补录的备注会以黄色高亮显示在原始记录下方，导出报告会明确标记差异，
              便于后续交接时了解哪些是原始记录、哪些是后续补充的说明。
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-mono border-2 border-charcoal/30 
                hover:bg-charcoal/10 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="px-4 py-2 text-sm font-mono bg-charcoal text-paper-cream 
                hover:bg-charcoal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存补录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
