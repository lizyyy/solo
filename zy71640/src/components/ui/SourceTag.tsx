import { Mail, MessageCircle, Table, PenLine, FileText, HelpCircle } from 'lucide-react'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import { SOURCE_TYPE_LABELS } from '@/types'
import type { SourceType } from '@/types'

const SOURCE_CONFIG: Record<SourceType, { icon: React.ElementType; color: string; bg: string }> = {
  email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-400/15' },
  chat: { icon: MessageCircle, color: 'text-green-400', bg: 'bg-green-400/15' },
  spreadsheet: { icon: Table, color: 'text-purple-400', bg: 'bg-purple-400/15' },
  manual: { icon: PenLine, color: 'text-zinc-400', bg: 'bg-zinc-400/15' },
  report: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-400/15' },
  other: { icon: HelpCircle, color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
}

interface SourceTagProps {
  sourceId: string
}

export default function SourceTag({ sourceId }: SourceTagProps) {
  const sources = useExhibitionStore((s) => s.sources)
  const source = sources.find((s) => s.id === sourceId)

  if (!source) return null

  const config = SOURCE_CONFIG[source.type]
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${config.bg} ${config.color}`}>
      <Icon size={12} />
      {SOURCE_TYPE_LABELS[source.type]}
    </span>
  )
}
