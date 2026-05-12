import { usePalletStore } from '../store'
import { Package, Truck, Users, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useEffect } from 'react'

export default function Dashboard() {
  const { getDashboardStats, getPendingRecords, getCompletedRecords, getBlockedRecords, checkOverdue, exportCustomerDetails } = usePalletStore()
  const stats = getDashboardStats()
  const pendingRecords = getPendingRecords()
  const completedRecords = getCompletedRecords()
  const blockedRecords = getBlockedRecords()

  useEffect(() => {
    checkOverdue()
  }, [checkOverdue])

  const statCards = [
    { label: '在库托盘', value: stats.inStock, icon: Package, color: 'bg-green-500' },
    { label: '在途托盘', value: stats.inTransit, icon: Truck, color: 'bg-blue-500' },
    { label: '客户持有', value: stats.withCustomer, icon: Users, color: 'bg-yellow-500' },
    { label: '待赔付', value: stats.pendingCompensation, icon: AlertTriangle, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">物流托盘循环台</h1>
        <button
          onClick={() => exportCustomerDetails()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          导出客户明细
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">待处理 ({pendingRecords.length})</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingRecords.map((record) => (
              <div key={record.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-medium text-gray-800">{record.title}</p>
                <p className="text-sm text-gray-500 mt-1">{record.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(record.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {pendingRecords.length === 0 && (
              <p className="text-gray-400 text-center py-4">暂无待处理记录</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold">已完成 ({completedRecords.length})</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {completedRecords.slice(0, 15).map((record) => (
              <div key={record.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="font-medium text-gray-800">{record.title}</p>
                <p className="text-sm text-gray-500 mt-1">{record.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(record.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {completedRecords.length === 0 && (
              <p className="text-gray-400 text-center py-4">暂无已完成记录</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">被拦截 ({blockedRecords.length})</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {blockedRecords.map((record) => (
              <div key={record.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="font-medium text-gray-800">{record.title}</p>
                <p className="text-sm text-gray-500 mt-1">{record.description}</p>
                {record.blockReason && (
                  <p className="text-sm text-red-600 mt-2 bg-red-100 p-2 rounded">
                    ⚠️ {record.blockReason}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(record.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            {blockedRecords.length === 0 && (
              <p className="text-gray-400 text-center py-4">暂无拦截记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
