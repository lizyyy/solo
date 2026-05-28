import { useState } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { Pencil, Check, X } from 'lucide-react'

export default function DetailTable() {
  const exposures = useExposureStore((s) => s.exposures)
  const subsidiaries = useExposureStore((s) => s.subsidiaries)
  const selectedNodeId = useExposureStore((s) => s.selectedNodeId)
  const updateExposureNote = useExposureStore((s) => s.updateExposureNote)
  const toggleExposureHedge = useExposureStore((s) => s.toggleExposureHedge)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const filtered = selectedNodeId
    ? selectedNodeId.startsWith('cur-')
      ? (() => {
          const parts = selectedNodeId.replace('cur-', '').split('-')
          const subId = parts[0]
          const curCode = parts.slice(1).join('-')
          return exposures.filter((e) => e.subsidiaryId === subId && e.currencyCode === curCode)
        })()
      : selectedNodeId.startsWith('sub-')
        ? exposures.filter((e) => e.subsidiaryId === selectedNodeId.replace('sub-', ''))
        : exposures
    : exposures

  const startEdit = (id: string, currentNote: string) => {
    setEditingNote(id)
    setNoteText(currentNote)
  }

  const saveNote = (id: string) => {
    updateExposureNote(id, noteText)
    setEditingNote(null)
    setNoteText('')
  }

  const cancelEdit = () => {
    setEditingNote(null)
    setNoteText('')
  }

  if (exposures.length === 0) {
    return (
      <div className="text-center text-txt-muted py-8 text-sm">
        暂无数据，请先导入或加载演示数据
      </div>
    )
  }

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel z-10">
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-txt-secondary font-medium">子公司</th>
            <th className="text-left py-2 px-2 text-txt-secondary font-medium">币种</th>
            <th className="text-right py-2 px-2 text-txt-secondary font-medium">金额</th>
            <th className="text-center py-2 px-2 text-txt-secondary font-medium">方向</th>
            <th className="text-center py-2 px-2 text-txt-secondary font-medium">套保</th>
            <th className="text-left py-2 px-2 text-txt-secondary font-medium">到期日</th>
            <th className="text-left py-2 px-2 text-txt-secondary font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((exp) => {
            const sub = subsidiaries.find((s) => s.id === exp.subsidiaryId)
            const isSelected = selectedNodeId === `cur-${exp.subsidiaryId}-${exp.currencyCode}`
            return (
              <tr
                key={exp.id}
                className={`border-b border-border/50 transition-colors ${isSelected ? 'bg-accent-green/5' : 'hover:bg-card'}`}
              >
                <td className="py-2 px-2">{sub?.name || exp.subsidiaryId}</td>
                <td className="py-2 px-2 font-mono">{exp.currencyCode}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {exp.amount.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${exp.direction === 'LONG' ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                    {exp.direction === 'LONG' ? '多' : '空'}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    className={`px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${exp.hedged ? 'bg-accent-gold/15 text-accent-gold' : 'bg-card text-txt-muted'}`}
                    onClick={() => toggleExposureHedge(exp.id, exp.hedgeContractNo)}
                  >
                    {exp.hedged ? '已套保' : '未套保'}
                  </button>
                </td>
                <td className="py-2 px-2 text-txt-secondary">{exp.dueDate}</td>
                <td className="py-2 px-2">
                  {editingNote === exp.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="bg-deep border border-border rounded px-1 py-0.5 text-xs w-24 text-txt-primary outline-none focus:border-accent-green"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveNote(exp.id); if (e.key === 'Escape') cancelEdit() }}
                        autoFocus
                      />
                      <button className="text-accent-green hover:text-accent-green/80" onClick={() => saveNote(exp.id)}><Check size={12} /></button>
                      <button className="text-accent-red hover:text-accent-red/80" onClick={cancelEdit}><X size={12} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <span className="text-txt-muted truncate max-w-[100px]" title={exp.manualNote}>
                        {exp.manualNote || '-'}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-accent-green transition-opacity"
                        onClick={() => startEdit(exp.id, exp.manualNote)}
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
