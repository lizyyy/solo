import { useNavigate } from 'react-router-dom'
import { useRenewalStore } from '@/store/useRenewalStore'
import { STATUS_LABELS, EXCEPTION_LABELS } from '@/types'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import type { RenewalTask } from '@/types'

const STATUS_DOT_COLORS: Record<RenewalTask['status'], string> = {
  pending: 'bg-surface-400',
  processing: 'bg-accent-blue',
  completed: 'bg-accent-green',
  exception: 'bg-accent-red',
}

export default function TaskList() {
  const navigate = useNavigate()
  const { tasks } = useRenewalStore()

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<RenewalTask['status'], number> = { exception: 0, pending: 1, processing: 2, completed: 3 }
    return order[a.status] - order[b.status]
  })

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <h3 className="text-sm font-medium text-surface-200 mb-4">待处理任务</h3>
      <div className="space-y-2">
        {sortedTasks.map((task) => (
          <button
            key={task.id}
            onClick={() => navigate(`/business-line/${task.id}`)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-surface-700/40 hover:bg-surface-700/80 transition-colors text-left group"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[task.status]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-surface-100 font-medium truncate">
                  {task.customerName}
                </span>
                <span className="text-[11px] text-surface-400 font-mono">
                  {task.plateNumber}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-surface-400">
                  {STATUS_LABELS[task.status]}
                </span>
                {task.exceptionTypes.length > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-accent-orange" />
                    <span className="text-[11px] text-accent-orange">
                      {task.exceptionTypes.map((e) => EXCEPTION_LABELS[e]).join('、')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
