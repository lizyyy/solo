import { Settings, Link, GitMerge, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { SourceAttachment } from '@/types'

type EventType = 'parameter_change' | 'source_import' | 'conflict_resolve' | 'record_create'

interface TimelineEvent {
  id: string
  timestamp: string
  type: EventType
  description: string
  recordName?: string
  sourceType?: string
  sourceRef?: string
  resolved?: boolean
}

const TYPE_CONFIG: Record<EventType, { icon: typeof Settings; label: string; color: string; bg: string }> = {
  parameter_change: { icon: Settings, label: '参数变更', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  source_import: { icon: Link, label: '来源导入', color: 'text-green-400', bg: 'bg-green-500/20' },
  conflict_resolve: { icon: GitMerge, label: '冲突处理', color: 'text-red-400', bg: 'bg-red-500/20' },
  record_create: { icon: MapPin, label: '记录创建', color: 'text-amber-400', bg: 'bg-amber-500/20' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function buildTimeline(
  parameterChanges: ReturnType<typeof useStore.getState>['parameterChanges'],
  sourcesByRecord: Record<string, SourceAttachment[]>,
  conflicts: ReturnType<typeof useStore.getState>['conflicts'],
  records: ReturnType<typeof useStore.getState>['records'],
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const pc of parameterChanges) {
    events.push({
      id: pc.id,
      timestamp: pc.changedAt,
      type: 'parameter_change',
      description: `${pc.parameterName}: ${pc.oldValue} → ${pc.newValue}${pc.reason ? `（${pc.reason}）` : ''}`,
      recordName: pc.changedBy,
    })
  }

  for (const sources of Object.values(sourcesByRecord)) {
    for (const s of sources) {
      const record = records.find(r => r.id === s.recordId)
      events.push({
        id: s.id,
        timestamp: s.importedAt,
        type: 'source_import',
        description: s.description || s.sourceName,
        recordName: record?.name,
        sourceType: s.sourceType,
        sourceRef: s.sourceRef,
      })
    }
  }

  for (const c of conflicts) {
    if (!c.resolvedAt) continue
    const record = records.find(r => r.id === c.recordId)
    events.push({
      id: c.id,
      timestamp: c.resolvedAt,
      type: 'conflict_resolve',
      description: c.resolution || c.suggestion,
      recordName: record?.name,
      resolved: true,
    })
  }

  for (const r of records) {
    events.push({
      id: r.id,
      timestamp: r.createdAt,
      type: 'record_create',
      description: `创建热斑记录 ${r.name}，温度 ${r.temperature}°`,
      recordName: r.name,
    })
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return events
}

function EventCard({ event }: { event: TimelineEvent }) {
  const config = TYPE_CONFIG[event.type]
  const Icon = config.icon
  const conflictColor = event.type === 'conflict_resolve' && event.resolved ? 'text-green-400' : config.color
  const conflictBg = event.type === 'conflict_resolve' && event.resolved ? 'bg-green-500/20' : config.bg

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center w-24 shrink-0 pt-1">
        <span className="text-xs text-gray-400">{formatDate(event.timestamp)}</span>
        <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
      </div>
      <div className="relative flex flex-col items-center">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center z-10',
          event.type === 'conflict_resolve' ? conflictBg : config.bg,
        )}>
          <Icon className={cn('w-4 h-4', event.type === 'conflict_resolve' ? conflictColor : config.color)} />
        </div>
        <div className="w-0.5 flex-1 bg-amber-500/30 group-last:bg-transparent" />
      </div>
      <div className="flex-1 pb-6">
        <div className={cn(
          'rounded-lg border border-gray-700/50 p-3',
          'bg-[#1a1a2e]/80 hover:border-gray-600/50 transition-colors',
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
              event.type === 'conflict_resolve' ? conflictBg + ' ' + conflictColor : config.bg + ' ' + config.color,
            )}>
              {config.label}
            </span>
            {event.sourceType && (
              <span className="text-xs text-gray-500">{event.sourceType} · {event.sourceRef}</span>
            )}
          </div>
          <p className="text-sm text-gray-200">{event.description}</p>
          {event.recordName && (
            <p className="text-xs text-gray-500 mt-1">关联记录: {event.recordName}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Timeline() {
  const records = useStore(s => s.records)
  const sourcesByRecord = useStore(s => s.sourcesByRecord)
  const conflicts = useStore(s => s.conflicts)
  const parameterChanges = useStore(s => s.parameterChanges)

  const events = buildTimeline(parameterChanges, sourcesByRecord, conflicts, records)

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        暂无时间线数据
      </div>
    )
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-180px)]">
      <div className="relative pl-2">
        <div className="absolute left-[7.75rem] top-0 bottom-0 w-0.5 bg-amber-500/30" />
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
