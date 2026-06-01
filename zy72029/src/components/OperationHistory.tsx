import { useRef, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { OperationLog, PauseRecord } from '@/types'
import { Clock, MousePointer2, Move, Trash2, AlertCircle } from 'lucide-react'

interface Props {
  onAddSupplement: (operationId: string) => void
}

export function OperationHistory({ onAddSupplement }: Props) {
  const { operationLogs, pauseRecords, materials, slots, supplementNotes } = useGameStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [operationLogs.length, pauseRecords.length])

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'place': return <Move size={12} />
      case 'remove': return <Trash2 size={12} />
      case 'click': return <MousePointer2 size={12} />
      default: return <AlertCircle size={12} />
    }
  }

  const getOperationColor = (log: OperationLog) => {
    if (log.operationType === 'place') {
      return log.isCorrect ? 'text-success-green' : log.scoreDelta && log.scoreDelta >= 0 ? 'text-warning-orange' : 'text-danger-red'
    }
    if (log.operationType === 'remove') return 'text-warning-orange'
    return 'text-calm-blue'
  }

  const getMaterialTitle = (id: string) => materials.find(m => m.id === id)?.title || id
  const getSlotLabel = (id?: string) => id ? slots.find(s => s.id === id)?.label || id : '-'

  const getSupplementForOperation = (opId: string) => {
    return supplementNotes.filter(n => n.operationId === opId)
  }

  const buildTimeline = () => {
    const items: Array<{ type: 'log' | 'pause'; data: OperationLog | PauseRecord; timestamp: string }> = []
    
    operationLogs.forEach(log => {
      items.push({ type: 'log', data: log, timestamp: log.timestamp })
    })
    
    pauseRecords.forEach(record => {
      items.push({ type: 'pause', data: record, timestamp: record.pauseTime })
    })

    return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const timeline = buildTimeline()

  return (
    <div className="h-full flex flex-col bg-charcoal/50 border-l border-white/10">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="font-mono font-bold text-sm text-paper-cream flex items-center gap-2">
          <Clock size={14} />
          操作历史（保留原始备注）
        </h3>
        <p className="text-[10px] text-white/40 mt-1">
          共 {operationLogs.length} 条操作 · {pauseRecords.length} 次暂停
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {timeline.length === 0 ? (
          <div className="text-center text-white/30 py-8 text-xs">
            暂无操作记录
          </div>
        ) : (
          timeline.map((item, idx) => {
            if (item.type === 'pause') {
              const pause = item.data as PauseRecord
              return (
                <div key={`pause-${idx}`} className="pause-marker my-2">
                  ⏸ {pause.reason}
                  {pause.isIntentional && <span className="ml-1 text-[10px]">(故意打断)</span>}
                </div>
              )
            }

            const log = item.data as OperationLog
            const supplements = getSupplementForOperation(log.id)

            return (
              <div
                key={log.id}
                className="p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-sm text-xs group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-white/40 font-mono whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className={`flex-shrink-0 mt-0.5 ${getOperationColor(log)}`}>
                    {getOperationIcon(log.operationType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${getOperationColor(log)}`}>
                      {log.operationType === 'place' && (
                        <>
                          放置「{getMaterialTitle(log.materialId)}」→「{getSlotLabel(log.targetSlot)}」
                          <span className="ml-2 text-white/50">
                            {log.isCorrect ? '✓' : '✗'}
                            {log.scoreDelta !== undefined && ` ${log.scoreDelta >= 0 ? '+' : ''}${log.scoreDelta}分`}
                            {log.riskDelta !== undefined && log.riskDelta !== 0 && ` 风险${log.riskDelta >= 0 ? '+' : ''}${log.riskDelta}`}
                          </span>
                        </>
                      )}
                      {log.operationType === 'remove' && (
                        <>
                          移除「{getMaterialTitle(log.materialId)}」
                          <span className="ml-2 text-white/50">-1分</span>
                        </>
                      )}
                      {log.operationType === 'click' && (
                        <>
                          点击「{getMaterialTitle(log.materialId)}」
                          {log.resourceDelta !== undefined && log.resourceDelta < 0 && (
                            <span className="ml-2 text-warning-orange">资源{log.resourceDelta}</span>
                          )}
                        </>
                      )}
                    </div>

                    {log.rawNote && (
                      <div className="raw-note text-[11px]">{log.rawNote}</div>
                    )}

                    {supplements.length > 0 && supplements.map(note => (
                      <div key={note.id} className="supplement-note text-[11px]">
                        <div className="text-[10px] text-warning-orange font-medium mb-1">
                          补录于 {formatTime(note.addedAt)} by {note.addedBy}
                        </div>
                        {note.content}
                      </div>
                    ))}

                    <button
                      onClick={() => onAddSupplement(log.id)}
                      className="mt-1 text-[10px] text-warning-orange/70 hover:text-warning-orange 
                        opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      + 补录备注
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
