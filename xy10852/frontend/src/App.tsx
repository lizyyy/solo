import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Bell, AlertTriangle, History, Download, Settings,
  Home, BarChart3, ChevronRight
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import AnomalyPage from './pages/AnomalyPage'
import HistoryPage from './pages/HistoryPage'
import ExportPage from './pages/ExportPage'
import PreferencesPage from './pages/PreferencesPage'
import { preferenceApi } from './services/api'
import type { StatsSummary } from './types'

function App() {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const location = useLocation()

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const response = await preferenceApi.getStats()
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const navItems = [
    { path: '/', label: '仪表盘', icon: Home },
    { path: '/preferences', label: '偏好管理', icon: Bell },
    { path: '/anomalies', label: '异常队列', icon: AlertTriangle, badge: stats?.anomalies.pending },
    { path: '/history', label: '历史轨迹', icon: History },
    { path: '/export', label: '数据导出', icon: Download },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">通知偏好</h1>
              <p className="text-xs text-gray-500">管理系统 v1.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {stats && (
          <div className="p-4 border-t">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <BarChart3 className="w-4 h-4" />
                <span>系统概览</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.preferences.active}</div>
                  <div className="text-xs text-gray-500">活跃偏好</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.anomalies.pending}</div>
                  <div className="text-xs text-gray-500">待处理异常</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/anomalies" element={<AnomalyPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
