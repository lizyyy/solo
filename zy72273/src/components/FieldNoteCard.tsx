import type { FieldTeamNote } from '@/types'
import { FileText, AlertCircle, Users, ArrowRight } from 'lucide-react'

const teamLabels: Record<string, string> = {
  inspection: '巡检组',
  operations: '园区运维',
}

interface FieldNoteCardProps {
  note: FieldTeamNote
}

export default function FieldNoteCard({ note }: FieldNoteCardProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-accent">
          <AlertCircle className="h-4 w-4" />
          <h4 className="text-sm font-medium">为什么留下</h4>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{note.whyLeftBehind}</p>
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center gap-2 text-status-red">
          <FileText className="h-4 w-4" />
          <h4 className="text-sm font-medium">缺什么材料</h4>
        </div>
        <ul className="space-y-1 pl-6">
          {note.missingMaterials.map((item, i) => (
            <li key={i} className="text-sm text-text-primary list-disc">{item}</li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center gap-2 text-status-blue">
          <Users className="h-4 w-4" />
          <h4 className="text-sm font-medium">下一步找谁</h4>
        </div>
        <p className="text-sm text-text-primary flex items-center gap-2">
          联系<span className="data-font text-accent">{teamLabels[note.nextStep.contactTeam] ?? note.nextStep.contactTeam}</span>
          <span className="data-font text-text-primary">{note.nextStep.contactPerson}</span>
          <ArrowRight className="h-3 w-3 text-text-secondary" />
          <span>{note.nextStep.action}</span>
        </p>
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-text-secondary">
        <span>版本 v{note.version}</span>
        <span className="data-font">{note.generatedAt}</span>
      </div>
    </div>
  )
}
