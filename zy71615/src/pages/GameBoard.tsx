import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { RoundInfo } from '../components/RoundInfo'
import { ExchangeRateBoard } from '../components/ExchangeRateBoard'
import { OrderCard } from '../components/OrderCard'
import { ContainerSlot } from '../components/ContainerSlot'
import { CabinSelector } from '../components/CabinSelector'
import { ActionBar } from '../components/ActionBar'
import { Package } from 'lucide-react'

export function GameBoard() {
  const { phase, orders, containers, startGame, unassignOrder, cancelOrder } = useGameStore()

  useEffect(() => {
    if (phase === 'setup') {
      startGame()
    }
  }, [phase, startGame])

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const loadedOrders = orders.filter(o => o.status === 'loaded')

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-400 font-serif tracking-wide">
            ⚓ 汇率港口装船赛
          </h1>
          <p className="text-slate-400 mt-2">
            拖拽订单卡到货柜区装载，选择舱位锁定，确认装船赚取利润
          </p>
        </header>

        <RoundInfo />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-6">
            <ExchangeRateBoard />
            <CabinSelector />
          </div>

          <div className="col-span-8 space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-amber-400 font-serif text-lg mb-4 flex items-center gap-2">
                <Package size={20} />
                待装船订单
              </h3>
              {pendingOrders.length === 0 ? (
                <div className="text-slate-500 text-center py-8">
                  暂无待装船订单
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onCancel={() => cancelOrder(order.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-amber-400 font-serif text-lg mb-4">货柜区</h3>
              <div className="grid grid-cols-6 gap-3">
                {containers.map(container => (
                  <ContainerSlot key={container.id} container={container} />
                ))}
              </div>
              {loadedOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="text-sm text-slate-400 mb-2">已装载订单：</div>
                  <div className="flex flex-wrap gap-2">
                    {loadedOrders.map(order => (
                      <button
                        key={order.id}
                        onClick={() => unassignOrder(order.id)}
                        className="px-3 py-1 bg-green-900/50 text-green-300 rounded text-sm hover:bg-green-900 transition-colors"
                      >
                        {order.id} ({order.commodity} × {order.quantity})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ActionBar />
          </div>
        </div>
      </div>
    </div>
  )
}
