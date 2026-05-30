import { useGameStore } from '@/store/gameStore'
import { Task, TaskType } from '@/types'
import { ClipboardList, ArrowUp, ArrowDown } from 'lucide-react'

const TASK_ICONS: Record<TaskType, string> = {
  deliver: '🍽',
  clear: '🧹',
}

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${seconds}s`
}

function TaskItem({ task, gameTime, onTaskClick, onPriorityUp, onPriorityDown }: {
  task: Task
  gameTime: number
  onTaskClick: () => void
  onPriorityUp: () => void
  onPriorityDown: () => void
}) {
  const remaining = task.deadline - gameTime
  const isUrgent = remaining < 5000 && remaining > 0
  const isOverdue = remaining <= 0
  const isAssigned = !!task.waiterId

  return (
    <div
      onClick={onTaskClick}
      role="button"
      className={`flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 transition-colors ${
        isAssigned ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-white/10'
      } ${isOverdue ? 'border border-red-500/50' : isUrgent ? 'border border-amber-500/50' : ''}`}
    >
      <span className="text-lg">{TASK_ICONS[task.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {task.tableId.toUpperCase()}
          {task.waiterId && <span className="text-xs text-[#4A90D9] ml-1">→ {task.waiterId.toUpperCase()}</span>}
        </div>
        <div className={`text-xs ${isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-white/50'}`}>
          截止: {formatCountdown(remaining)}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          onClick={e => { e.stopPropagation(); onPriorityUp() }}
          className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPriorityDown() }}
          className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/80"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
      <span className="text-xs text-white/30 w-6 text-right">P{task.priority}</span>
    </div>
  )
}

export default function TaskPanel() {
  const tasks = useGameStore(s => s.tasks)
  const gameTime = useGameStore(s => s.gameTime)
  const selectedWaiterId = useGameStore(s => s.selectedWaiterId)
  const assignTask = useGameStore(s => s.assignTask)
  const setTaskPriority = useGameStore(s => s.setTaskPriority)

  const uncompleted = tasks
    .filter(t => !t.completed)
    .sort((a, b) => a.priority - b.priority)

  const handleTaskClick = (task: Task) => {
    if (task.waiterId) return
    if (!selectedWaiterId) return
    assignTask(selectedWaiterId, task.id)
  }

  const handlePriorityUp = (task: Task) => {
    if (task.priority > 1) {
      setTaskPriority(task.id, task.priority - 1)
    }
  }

  const handlePriorityDown = (task: Task) => {
    setTaskPriority(task.id, task.priority + 1)
  }

  return (
    <div className="w-72 bg-[#1A1A2E]/90 text-white p-4 flex flex-col gap-3 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-[#F0A500]" />
        <h2 className="text-lg font-bold">任务队列</h2>
        <span className="ml-auto text-xs text-white/50">{uncompleted.length} 项</span>
      </div>

      {selectedWaiterId ? (
        <div className="bg-[#F0A500]/20 text-[#F0A500] text-xs rounded-lg px-3 py-2">
          已选择服务员 {selectedWaiterId.toUpperCase()}，点击任务分配
        </div>
      ) : (
        <div className="bg-white/5 text-white/40 text-xs rounded-lg px-3 py-2">
          请先在左侧选择空闲服务员
        </div>
      )}

      <div className="flex flex-col gap-2">
        {uncompleted.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            gameTime={gameTime}
            onTaskClick={() => handleTaskClick(task)}
            onPriorityUp={() => handlePriorityUp(task)}
            onPriorityDown={() => handlePriorityDown(task)}
          />
        ))}
        {uncompleted.length === 0 && (
          <div className="text-center text-white/30 text-sm py-8">暂无待处理任务</div>
        )}
      </div>
    </div>
  )
}
