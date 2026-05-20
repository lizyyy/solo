import { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle, RotateCcw, ChevronDown } from 'lucide-react'
import { preferenceApi } from '../services/api'
import type { AnomalyQueue } from '../types'

export default function AnomalyPage() {
  const [anomalies, setAnomalies] = useState<AnomalyQueue[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('pending')
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyQueue | null>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

  useEffect(() => {
    loadAnomalies()
  }, [filter])

  const loadAnomalies = async () => {
    setLoading(true)
    try {
      const response = await preferenceApi.getAnomalies({
        status: filter === 'all' ? undefined : filter
      })
      setAnomalies(response.data)
    } catch (error) {
      console.error('Failed to load anomalies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (anomaly: AnomalyQueue) => {
    try {
      await preferenceApi.advanceAnomaly({
        anomaly_id: anomaly.id,
        target_status: 'retrying',
        resolver: 'admin'
      })
      loadAnomalies()
    } catch (error) {
      console.error('Failed to retry anomaly:', error)
    }
  }

  const handleResolve = async () => {
    if (!selectedAnomaly) return
    try {
      await preferenceApi.advanceAnomaly({
        anomaly_id: selectedAnomaly.id,
        target_status: 'resolved',
        resolution_note: resolutionNote,
        resolver: 'admin'
      })
      setShowResolveModal(false)
      setSelectedAnomaly(null)
      setResolutionNote('')
      loadAnomalies()
    } catch (error) {
      console.error('Failed to resolve anomaly:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">异常队列</h1>
          <p className="text-gray-500 mt-1">处理通知偏好同步异常</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="retrying">重试中</option>
            <option value="resolved">已解决</option>
          </select>
          <button
            onClick={loadAnomalies}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-gray-800">
                {anomalies.filter((a) => a.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">重试中</p>
              <p className="text-2xl font-bold text-gray-800">
                {anomalies.filter((a) => a.status === 'retrying').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已解决</p>
              <p className="text-2xl font-bold text-gray-800">
                {anomalies.filter((a) => a.status === 'resolved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">异常类型</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">用户ID</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">渠道</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">场景</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">描述</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">重试次数</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">状态</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {anomalies.map((anomaly) => (
              <tr key={anomaly.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-gray-800">{anomaly.anomaly_type}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-800">{anomaly.user_id}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {anomaly.channel.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">{anomaly.business_scene}</td>
                <td className="px-6 py-4 text-gray-600 text-sm max-w-xs truncate">
                  {anomaly.description}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-medium ${
                    anomaly.retry_count >= anomaly.max_retries ? 'text-red-600' : 'text-gray-800'
                  }`}>
                    {anomaly.retry_count} / {anomaly.max_retries}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    anomaly.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    anomaly.status === 'retrying' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {anomaly.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {anomaly.status !== 'resolved' && (
                    <div className="flex items-center gap-2">
                      {anomaly.retry_count < anomaly.max_retries && (
                        <button
                          onClick={() => handleRetry(anomaly)}
                          className="p-1 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title="重试"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedAnomaly(anomaly)
                          setShowResolveModal(true)
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="标记为已解决"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {anomalies.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                  暂无异常数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showResolveModal && selectedAnomaly && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-800 mb-6">标记为已解决</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">异常ID:</span> {selectedAnomaly.id}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">用户ID:</span> {selectedAnomaly.user_id}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">异常类型:</span> {selectedAnomaly.anomaly_type}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">解决备注</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请输入解决备注..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                确认解决
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
