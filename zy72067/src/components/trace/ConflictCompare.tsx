import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Camera, MessageSquare, StickyNote, Crosshair } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { SourceType, ConflictType, SourceAttachment } from '@/types'

const SOURCE_ICONS: Record<SourceType, typeof FileText> = {
  point_table: FileText,
  photo: Camera,
  meeting_screenshot: MessageSquare,
  plan_note: StickyNote,
  manual_coordinate: Crosshair,
}

const CONFLICT_LABELS: Record<ConflictType, string> = {
  coordinate_mismatch: '坐标不匹配',
  value_mismatch: '数值不匹配',
  coordinate_system_mismatch: '坐标系不匹配',
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
}

function SourceCard({ source, side }: { source?: SourceAttachment; side: 'A' | 'B' }) {
  if (!source) {
    return (
      <div className="flex-1 p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
        <p className="text-gray-500 text-sm">来源{side}信息不可用</p>
      </div>
    )
  }
  const Icon = SOURCE_ICONS[source.sourceType] || FileText
  return (
    <div className="flex-1 p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-200">{source.sourceName}</span>
      </div>
      <div className="space-y-1 text-xs">
        <p className="text-gray-400">类型: <span className="text-gray-300">{source.sourceType}</span></p>
        <p className="text-gray-400">引用: <span className="text-gray-300">{source.sourceRef}</span></p>
        {source.description && (
          <p className="text-gray-400">描述: <span className="text-gray-300">{source.description}</span></p>
        )}
      </div>
    </div>
  )
}

function ConflictItem({ conflict }: { conflict: ReturnType<typeof useStore.getState>['conflicts'][0] }) {
  const [expanded, setExpanded] = useState(false)
  const [decision, setDecision] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const resolveConflict = useStore(s => s.resolveConflict)
  const records = useStore(s => s.records)
  const isResolved = !!conflict.resolvedAt
  const record = records.find(r => r.id === conflict.recordId)

  const handleResolve = async () => {
    if (!decision || !reason) return
    setSubmitting(true)
    try {
      await resolveConflict(conflict.id, `${decision}: ${reason}`, '当前用户')
      setDecision('')
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden bg-[#1a1a2e]/60">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-sm font-medium text-gray-200 flex-1 text-left">
          {record?.name || conflict.recordId}
        </span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded',
          conflict.conflictType === 'coordinate_system_mismatch' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400',
        )}>
          {CONFLICT_LABELS[conflict.conflictType]}
        </span>
        <span className={cn('w-2 h-2 rounded-full', SEVERITY_COLORS[conflict.severity])} />
        <span className={cn(
          'text-xs px-2 py-0.5 rounded',
          isResolved ? 'bg-gray-500/20 text-gray-400' : 'bg-amber-500/20 text-amber-400',
        )}>
          {isResolved ? '已处理' : '待处理'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-3">
            <SourceCard source={conflict.sourceA} side="A" />
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              <span className="text-xs text-gray-500 font-medium mb-1">VS</span>
              <span className="text-xs text-gray-600 max-w-[80px] text-center">
                {CONFLICT_LABELS[conflict.conflictType]}
              </span>
            </div>
            <SourceCard source={conflict.sourceB} side="B" />
          </div>

          {conflict.conflictType === 'coordinate_system_mismatch' && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-300">
                坐标系标注说明：两个来源使用不同坐标系，其坐标数据不能直接合并，需分别处理或在统一坐标系下转换后再比较。
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 mb-1">建议动作</p>
            <p className="text-sm text-gray-300">{conflict.suggestion}</p>
          </div>

          {isResolved ? (
            <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="text-gray-500">已处理</span>
                <span>处理人: {conflict.resolvedBy}</span>
                <span>时间: {conflict.resolvedAt}</span>
                <span>方式: {conflict.resolution}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-gray-700/50 bg-gray-800/30 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">选择决策</label>
                <select
                  value={decision}
                  onChange={e => setDecision(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">请选择...</option>
                  <option value="采用A">采用来源A</option>
                  <option value="采用B">采用来源B</option>
                  <option value="标记为已知差异">标记为已知差异</option>
                  <option value="需要更多信息">需要更多信息</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">决策原因</label>
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="请输入决策原因..."
                  className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleResolve}
                disabled={!decision || !reason || submitting}
                className={cn(
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors',
                  decision && reason && !submitting
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed',
                )}
              >
                {submitting ? '处理中...' : '确认处理'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConflictCompare() {
  const conflicts = useStore(s => s.conflicts)
  const unresolved = conflicts.filter(c => !c.resolvedAt)
  const resolved = conflicts.filter(c => c.resolvedAt)

  if (conflicts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        暂无冲突记录
      </div>
    )
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-180px)] space-y-3">
      {unresolved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            未解决冲突 ({unresolved.length})
          </h3>
          {unresolved.map(c => <ConflictItem key={c.id} conflict={c} />)}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            已解决冲突 ({resolved.length})
          </h3>
          {resolved.map(c => <ConflictItem key={c.id} conflict={c} />)}
        </div>
      )}
    </div>
  )
}
