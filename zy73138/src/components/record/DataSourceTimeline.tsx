import { useMemo } from 'react'
import { FileText, Paperclip, MessageSquare, Download } from 'lucide-react'
import type { SourceType, DataSourceEntry } from '@/types'
import { SOURCE_TYPE_LABELS } from '@/types'
import { formatDateTime, getSourceTypeColor } from '@/utils'
import { useWaterQualityStore } from '@/store'

const SOURCE_ICONS: Record<SourceType, React.ElementType> = {
  original: FileText,
  late_attachment: Paperclip,
  supplementary_note: MessageSquare,
  latest_export: Download,
}

interface DataSourceTimelineProps {
  recordId: string
}

export default function DataSourceTimeline({ recordId }: DataSourceTimelineProps) {
  const allDataSources = useWaterQualityStore((s) => s.dataSources)
  const dataSources = useMemo(
    () => allDataSources.filter((ds) => ds.recordId === recordId),
    [allDataSources, recordId]
  )

  if (dataSources.length === 0) {
    return (
      <div className="rounded-lg border border-ocean-700/50 bg-ocean-900 p-5">
        <h3 className="mb-3 font-serif text-lg text-foam">数据来源</h3>
        <p className="text-sm text-foam/50">暂无数据来源记录</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-ocean-700/50 bg-ocean-900 p-5">
      <h3 className="mb-4 font-serif text-lg text-foam">数据来源</h3>

      <div className="relative ml-2">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-ocean-700/60" />

        <div className="flex flex-col gap-4">
          {dataSources.map((entry) => (
            <TimelineNode key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineNode({ entry }: { entry: DataSourceEntry }) {
  const Icon = SOURCE_ICONS[entry.sourceType]
  const isLate = entry.sourceType === 'late_attachment'
  const isSupplementary = entry.sourceType === 'supplementary_note'

  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ocean-800 ring-2 ring-ocean-700/60">
        <Icon className="h-2.5 w-2.5 text-foam/70" />
      </div>

      <div
        className={`rounded-md border bg-ocean-800/60 p-3 ${
          isLate
            ? 'border-l-2 border-l-sand border-ocean-700/30'
            : isSupplementary
            ? 'border-dashed border-ocean-700/40'
            : 'border-ocean-700/30'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${getSourceTypeColor(
              entry.sourceType,
            )}`}
          >
            {SOURCE_TYPE_LABELS[entry.sourceType]}
          </span>
          <span className="text-xs text-foam/40">
            {formatDateTime(entry.timestamp)}
          </span>
        </div>

        <p className="text-sm text-foam/80 mb-1">{entry.description}</p>

        <span className="text-xs text-foam/40">操作人: {entry.operator}</span>
      </div>
    </div>
  )
}
