import { useGameStore } from '@/store/gameStore'
import { TABLE_STATUS_LABELS, TableStatus } from '@/types'
import { Users, Armchair } from 'lucide-react'

const STATUS_COLORS: Record<TableStatus, string> = {
  idle: 'bg-gray-400',
  ordered: 'bg-amber-400',
  serving: 'bg-blue-400',
  eating: 'bg-green-400',
  needs_clearing: 'bg-red-400',
  clearing: 'bg-purple-400',
}

export default function StatusPanel() {
  const tables = useGameStore(s => s.tables)
  const waiters = useGameStore(s => s.waiters)
  const selectWaiter = useGameStore(s => s.selectWaiter)
  const selectedWaiterId = useGameStore(s => s.selectedWaiterId)

  const idleWaiters = waiters.filter(w => w.state === 'idle').length
  const busyWaiters = waiters.length - idleWaiters

  return (
    <div className="w-64 bg-[#1A1A2E]/90 text-white p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Armchair className="w-5 h-5 text-[#F0A500]" />
        <h2 className="text-lg font-bold">桌位状态</h2>
      </div>

      <div className="flex flex-col gap-2">
        {tables.map(table => (
          <div
            key={table.id}
            className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
          >
            <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[table.status]}`} />
            <span className="text-sm flex-1">{table.id.toUpperCase()}</span>
            <span className="text-xs text-white/60">{TABLE_STATUS_LABELS[table.status]}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-[#4A90D9]" />
          <h2 className="text-lg font-bold">服务员</h2>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-green-500/20 text-green-400 rounded-lg px-3 py-2 text-center">
            <div className="text-xl font-bold">{idleWaiters}</div>
            <div className="text-xs">空闲</div>
          </div>
          <div className="flex-1 bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-center">
            <div className="text-xl font-bold">{busyWaiters}</div>
            <div className="text-xs">忙碌</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {waiters.map(waiter => {
            const isIdle = waiter.state === 'idle'
            const isSelected = selectedWaiterId === waiter.id
            return (
              <button
                key={waiter.id}
                onClick={() => {
                  if (!isIdle) return
                  selectWaiter(isSelected ? null : waiter.id)
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                  isIdle
                    ? 'bg-white/5 hover:bg-white/10 cursor-pointer'
                    : 'bg-white/5 opacity-50 cursor-not-allowed'
                } ${isSelected ? 'ring-2 ring-[#F0A500] bg-[#F0A500]/10' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${isIdle ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="flex-1">{waiter.id.toUpperCase()}</span>
                <span className="text-xs text-white/50">
                  {isIdle ? '空闲' : '执行中'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
