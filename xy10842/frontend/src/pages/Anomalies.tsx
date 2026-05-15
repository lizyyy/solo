import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { evaluations } from '../services/api'
import { Evaluation } from '../types'

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnomalies()
  }, [])

  const fetchAnomalies = async () => {
    try {
      const data = await evaluations.getAnomalies()
      setAnomalies(data)
    } catch (error) {
      console.error('Failed to fetch anomalies:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">异常队列</h1>
        <button
          onClick={fetchAnomalies}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          刷新
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-4">🎉</p>
            <p>暂无异常！</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-red-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">数据集</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">错误信息</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {anomalies.map((evaluation) => (
                <tr key={evaluation.id} className="bg-red-50/30">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{evaluation.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{evaluation.dataset_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      {evaluation.status === 'error' ? '异常' : '失败'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {evaluation.error_message || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(evaluation.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    <Link to={`/evaluations/${evaluation.id}`}>查看详情</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
