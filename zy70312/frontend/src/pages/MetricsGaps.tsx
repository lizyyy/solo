import { useState, useEffect } from 'react'
import { dashboardAPI } from '../api/client'
import { formatTime } from '../utils'
import type { MetricsGap } from '../types'

export default function MetricsGaps() {
  const [gaps, setGaps] = useState<MetricsGap[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const fetchData = async () => {
    try {
      const data = await dashboardAPI.getMetricsGaps()
      setGaps(data)
    } catch (error) {
      console.error('Failed to fetch metrics gaps:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }
  
  if (loading) {
    return <div className="card p-8 text-center text-gray-500">加载中...</div>
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">指标缺口检测</h2>
          <p className="text-gray-500 mt-1">指标缺口不能被当成健康，必须单独进入待确认列表</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
        >
          <svg className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
      
      {gaps.length === 0 ? (
        <div className="card p-8 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">所有指标正常</h3>
          <p className="text-gray-500">未检测到指标缺口，所有服务的指标上报正常</p>
        </div>
      ) : (
        <>
          <div className="card p-5 border-l-4 border-l-yellow-500 bg-yellow-50">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-medium text-yellow-800">检测到 {gaps.length} 个指标缺口</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  这些服务或接口的指标上报存在缺口，发布前需要确认指标采集是否正常。
                  指标缺失期间的健康状态不可信，需人工确认。
                </p>
              </div>
            </div>
          </div>
          
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">服务</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">接口</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缺口时长</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后可见时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {gaps.map((gap, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{gap.serviceName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{gap.endpointPath || '服务级'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          {gap.gapDurationHours < 0 ? '从未上报' : `${gap.gapDurationHours} 小时`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {gap.lastSeenAt ? formatTime(gap.lastSeenAt) : '无记录'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="status-badge status-missing_metrics">
                          待确认
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="card p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">排查建议</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>检查指标采集服务（如 Prometheus、Telegraf 等）是否正常运行</li>
              <li>检查目标服务的指标暴露端点是否可访问</li>
              <li>检查网络连通性和防火墙规则</li>
              <li>检查服务日志中是否有指标上报相关的错误</li>
              <li>确认指标缺口期间是否有发布或变更操作</li>
              <li>在确认指标正常前，该服务的发布需要经过例外审批</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
