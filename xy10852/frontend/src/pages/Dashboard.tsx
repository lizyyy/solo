import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, AlertTriangle, History, CheckCircle, XCircle,
  TrendingUp, Users, MessageSquare, Mail, Smartphone
} from 'lucide-react'
import { preferenceApi } from '../services/api'
import type { StatsSummary, Preference, AnomalyQueue } from '../types'

export default function Dashboard() {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [recentPreferences, setRecentPreferences] = useState<Preference[]>([])
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyQueue[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, prefRes, anomRes] = await Promise.all([
        preferenceApi.getStats(),
        preferenceApi.getAll({ limit: 5 }),
        preferenceApi.getAnomalies({ limit: 5 })
      ])
      setStats(statsRes.data)
      setRecentPreferences(prefRes.data)
      setRecentAnomalies(anomRes.data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <Smartphone className="w-4 h-4" />
      case 'email': return <Mail className="w-4 h-4" />
      case 'in_app': return <MessageSquare className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">仪表盘</h1>
          <p className="text-gray-500 mt-1">通知偏好系统概览</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">偏好总数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.preferences.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-green-600">{stats.preferences.active}</span>
            <span className="text-gray-400">活跃</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">异常总数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.anomalies.total}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-600">{stats.anomalies.pending}</span>
            <span className="text-gray-400">待处理</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">拦截总数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.interceptions.total}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-red-600">{(stats.interceptions.block_rate * 100).toFixed(1)}%</span>
            <span className="text-gray-400">拦截率</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">历史记录</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">-</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <History className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-purple-600">实时追踪</span>
            <span className="text-gray-400">变化</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">最近偏好</h2>
            <Link to="/preferences" className="text-blue-600 text-sm hover:underline">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {recentPreferences.map((pref) => (
              <div
                key={pref.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    {getChannelIcon(pref.channel)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{pref.user_id}</p>
                    <p className="text-xs text-gray-500">
                      {pref.channel} · {pref.business_scene}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium status-${pref.status}`}>
                  {pref.status}
                </span>
              </div>
            ))}
            {recentPreferences.length === 0 && (
              <p className="text-center text-gray-400 py-8">暂无数据</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">异常队列</h2>
            <Link to="/anomalies" className="text-blue-600 text-sm hover:underline">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {recentAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{anomaly.anomaly_type}</p>
                    <p className="text-xs text-gray-500">
                      {anomaly.user_id} · {anomaly.channel}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  anomaly.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  anomaly.status === 'retrying' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {anomaly.status}
                </span>
              </div>
            ))}
            {recentAnomalies.length === 0 && (
              <p className="text-center text-gray-400 py-8">暂无异常</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
