import { useState, useEffect, useCallback } from 'react'
import { statisticsApi } from '../lib/api'
import type { Statistics, TicketStatus } from '../types'
import { statusLabelMap, statusColorMap } from '../types'

export default function StatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await statisticsApi.get({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      })
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const statuses = Object.entries(statusLabelMap) as [TicketStatus, string][]

  const getStatusCount = (status: TicketStatus) => {
    if (!stats) return 0
    return stats.byStatus[status] || 0
  }

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">数据统计</h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col min-w-36">
            <label className="text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col min-w-36">
            <label className="text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            查询
          </button>

          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            清除筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={fetchData} className="ml-4 underline">重试</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          加载中...
        </div>
      ) : !stats ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{stats.totalTickets}</div>
              <div className="text-sm text-gray-500 mt-1">总工单数</div>
            </div>
            
            {statuses.map(([status, label]) => {
              const count = getStatusCount(status)
              return (
                <div key={status} className="bg-white rounded-lg shadow-sm border p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900">{count}</div>
                  <div className={`text-sm mt-1 inline-flex px-2 py-0.5 rounded-full ${statusColorMap[status]}`}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>

          {stats.overdueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-red-600 font-semibold text-lg mr-2">⚠️</span>
                <span className="text-red-800">
                  当前有 <span className="font-bold text-xl">{stats.overdueCount}</span> 个已逾期工单
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">工单状态分布</h2>
              <div className="space-y-4">
                {statuses.map(([status, label]) => {
                  const count = getStatusCount(status)
                  const percentage = stats.totalTickets > 0 
                    ? Math.round((count / stats.totalTickets) * 100) 
                    : 0
                  
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{label}</span>
                        <span className="text-gray-500">{count} 单 ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            status === 'PENDING_ASSIGNMENT' ? 'bg-yellow-500' :
                            status === 'IN_PROGRESS' ? 'bg-blue-500' :
                            status === 'PENDING_INSPECTION' ? 'bg-purple-500' :
                            status === 'COMPLETED' ? 'bg-green-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">材料使用排行</h2>
              {stats.materialsUsage.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无材料使用记录</p>
              ) : (
                <div className="space-y-3">
                  {stats.materialsUsage.slice(0, 10).map((item, index) => {
                    const maxQty = stats.materialsUsage[0]?.totalQuantity || 1
                    const percentage = Math.round((item.totalQuantity / maxQty) * 100)
                    
                    return (
                      <div key={item.name} className="flex items-center">
                        <div className="w-8 text-center mr-3">
                          <span className={`text-xs font-bold ${
                            index === 0 ? 'text-yellow-600' :
                            index === 1 ? 'text-gray-400' :
                            index === 2 ? 'text-orange-600' :
                            'text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{item.name}</span>
                            <span className="text-gray-500">{item.totalQuantity} 件</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-teal-500 transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">维修师傅工作量</h2>
            {stats.technicianStats.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无维修师傅数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        师傅姓名
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        派单总数
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        已完成
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        完成率
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        进度
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.technicianStats.map(tech => {
                      const completionRate = tech.ticketCount > 0 
                        ? Math.round((tech.completedCount / tech.ticketCount) * 100) 
                        : 0
                      
                      return (
                        <tr key={tech.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{tech.name}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="text-gray-700 font-medium">{tech.ticketCount}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="text-green-600 font-medium">{tech.completedCount}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className={`font-medium ${
                              completionRate >= 80 ? 'text-green-600' :
                              completionRate >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {completionRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 w-48">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  completionRate >= 80 ? 'bg-green-500' :
                                  completionRate >= 50 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
