import { useDrop } from '../hooks/useDrag'
import { useGameStore } from '../store/gameStore'
import { getCommodityEmoji } from '../engine/orderGenerator'
import type { Container } from '../engine/types'

interface ContainerSlotProps {
  container: Container
}

export function ContainerSlot({ container }: ContainerSlotProps) {
  const { orders, unassignOrder } = useGameStore()
  const order = orders.find(o => o.id === container.orderId)

  const { drop, isOver } = useDrop({
    accept: 'order',
    onDrop: (data: { orderId: string }) => {
      useGameStore.getState().assignOrderToContainer(data.orderId, container.id)
    },
  })

  const isLoaded = container.status === 'loaded'
  const isEmpty = container.status === 'empty'

  return (
    <div
      ref={drop}
      className={`
        w-20 h-20 border-2 rounded-lg flex flex-col items-center justify-center p-2
        transition-all duration-200
        ${isEmpty ? 'border-dashed border-slate-300 bg-slate-50' : ''}
        ${isLoaded ? 'border-solid border-green-400 bg-green-50' : ''}
        ${isOver ? 'border-amber-500 bg-amber-100 scale-105' : ''}
        ${isEmpty && !isOver ? 'hover:border-slate-400 hover:bg-slate-100' : ''}
      `}
    >
      {isEmpty ? (
        <span className="text-xs text-slate-400">空柜</span>
      ) : order ? (
        <div className="text-center cursor-pointer" onClick={() => unassignOrder(order.id)}>
          <span className="text-xl">{getCommodityEmoji(order.commodity)}</span>
          <div className="text-xs text-slate-600 truncate w-full">{order.commodity}</div>
        </div>
      ) : null}
    </div>
  )
}
