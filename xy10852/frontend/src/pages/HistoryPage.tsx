import { useState, useEffect } from 'react'
import { RefreshCw, Clock, User } from 'lucide-react'
import { preferenceApi } from '../services/api'
import type { ChangeHistory } from '../types'

export default function HistoryPage() {
  const [history, setHistory] = useState<ChangeHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [userIdFilter, setUserIdFilter] = useState('')

  useEffect(() => {
    loadHistory()
  }, [userIdFilter])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await preferenceApi.getHistory({
        user_id: userIdFilter || undefined
      })
      setHistory(response.data)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-green-100 text-green-800'
      case 'update': return 'bg-blue-100 text-blue-800'
      case 'merge': return 'bg-purple-100 text-purple-800'
      case 'priority_override': return 'bg-orange-100 text-orange-800'
      case 'merge_update': return 'bg-teal-100 text-teal-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">历史轨迹</h1>
          <p className="text-gray-500 mt-1">查看偏好变更历史记录</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="按用户ID筛选..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button
            onClick={loadHistory}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-800">
                      {item.user_id}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(item.change_type || '')}`}>
                      {item.change_type || 'unknown'}
                    </span>
                    {item.channel && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {item.channel.toUpperCase()}
                      </span>
                    )}
                    {item.business_scene && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {item.business_scene}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    操作人: {item.operator || 'system'} • 
                    关联偏好ID: {item.preference_id || 'N/A'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {item.old_value && Object.keys(item.old_value).length > 0 && (
                      <div className="bg-red-50 rounded-lg p-4">
                        <p className="text-xs font-medium text-red-600 mb-2">变更前</p>
                        <pre className="text-xs text-red-800 whitespace-pre-wrap">
                          {JSON.stringify(item.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {item.new_value && Object.keys(item.new_value).length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-xs font-medium text-green-600 mb-2">变更后</p>
                        <pre className="text-xs text-green-800 whitespace-pre-wrap">
                          {JSON.stringify(item.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {item.snapshot && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-2">快照数据</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(item.snapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-400 whitespace-nowrap">
                {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400">暂无历史记录</p>
          </div>
        )}
      </div>
    </div>
  )
}
