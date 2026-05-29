import { useEffect } from 'react'
import { Play, ArrowRight } from 'lucide-react'
import { useCallbackStore } from '@/store/useCallbackStore'
import StatusBadge from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

export default function Replay() {
  const { replayTasks, replayLoading, fetchReplayTasks, executeReplayTask } = useCallbackStore()

  useEffect(() => {
    fetchReplayTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">重放队列</h2>

      {replayLoading && (
        <p className="text-sm text-[var(--color-text-secondary)]">加载中...</p>
      )}

      {!replayLoading && replayTasks.length === 0 && (
        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">暂无重放任务</p>
        </div>
      )}

      <div className="space-y-3">
        {replayTasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                    {task.id}
                  </span>
                  <StatusBadge status={task.status} type="replay" />
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-secondary)]">callback_id:</span>
                    <span className="font-mono text-[var(--color-blue)]">{task.callback_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-secondary)]">idempotency_key:</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{task.idempotency_key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-secondary)]">幂等检查:</span>
                    <IdempotencyBadge result={task.idempotency_check} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-secondary)]">状态变化:</span>
                    <span className="font-mono text-[var(--color-text-primary)] flex items-center gap-1">
                      {task.status_before ?? '-'}
                      <ArrowRight size={10} className="text-[var(--color-text-secondary)]" />
                      {task.status_after ?? '-'}
                    </span>
                  </div>
                  {task.executed_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-secondary)]">执行时间:</span>
                      <span className="font-mono text-[var(--color-text-primary)]">
                        {new Date(task.executed_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  )}
                  {task.result && (
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-secondary)]">执行结果:</span>
                      <span className="font-mono text-[var(--color-text-primary)]">{task.result}</span>
                    </div>
                  )}
                </div>
              </div>

              {(task.status === 'queued' || task.status === 'failed') && (
                <button
                  onClick={() => executeReplayTask(task.id)}
                  className="flex items-center gap-1 h-8 px-3 rounded bg-[var(--color-amber)] text-xs font-medium text-[var(--color-bg-primary)] hover:opacity-90 transition-colors shrink-0 ml-4"
                >
                  <Play size={12} />
                  执行
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IdempotencyBadge({ result }: { result: string }) {
  const colorMap: Record<string, string> = {
    pass: 'text-[var(--color-emerald)]',
    fail: 'text-[var(--color-red)]',
    skip: 'text-[var(--color-text-secondary)]',
  }
  return (
    <span className={cn('font-mono text-xs font-medium', colorMap[result] ?? 'text-[var(--color-text-secondary)]')}>
      {result}
    </span>
  )
}
