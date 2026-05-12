import React, { useState, useEffect } from 'react'
import { OrderProvider, useOrderContext } from './store/OrderContext'
import { OrderCard } from './components/OrderCard'
import { FilterBar } from './components/FilterBar'
import { NewOrderModal } from './components/NewOrderModal'
import { sampleOrders } from './data/sampleOrders'
import { Plus, Eye, ClipboardList } from 'lucide-react'

const DashboardContent: React.FC = () => {
  const { orders, getFilteredOrders, importOrders } = useOrderContext()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized && orders.length === 0) {
      importOrders(sampleOrders)
      setInitialized(true)
    }
  }, [initialized, orders.length, importOrders])

  const filteredOrders = getFilteredOrders()

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['measuring', 'cutting', 'polishing', 'edging'].includes(o.status)).length,
    qualityCheck: orders.filter(o => o.status === 'quality-check').length,
    rework: orders.filter(o => o.reworkCount > 0).length,
    ready: orders.filter(o => o.status === 'ready').length,
    pickedUp: orders.filter(o => o.status === 'picked-up').length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Eye className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">眼镜店镜片加工看板</h1>
                <p className="text-sm text-gray-500">实时跟踪订单状态，避免轴位错误</p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <Plus size={18} />
              新建订单
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-sm text-gray-500">总订单</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-orange-500">{stats.pending + stats.processing}</div>
            <div className="text-sm text-gray-500">加工中</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-500">{stats.rework}</div>
            <div className="text-sm text-gray-500">返工订单</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-500">{stats.ready}</div>
            <div className="text-sm text-gray-500">待取镜</div>
          </div>
        </div>

        <FilterBar />

        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-600 mb-2">没有找到订单</h3>
            <p className="text-gray-400 text-sm">尝试调整筛选条件或创建新订单</p>
          </div>
        )}
      </main>

      <NewOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}

const App: React.FC = () => {
  return (
    <OrderProvider>
      <DashboardContent />
    </OrderProvider>
  )
}

export default App
