import React, { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RiskQueue from './pages/RiskQueue'
import ImportPage from './pages/ImportPage'
import ExportPage from './pages/ExportPage'
import ProgramDetail from './pages/ProgramDetail'

function App() {
  const location = useLocation()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const navItems = [
    { path: '/', label: '仪表板', icon: '📊' },
    { path: '/risks', label: '风险队列', icon: '⚠️' },
    { path: '/import', label: '导入资料', icon: '📥' },
    { path: '/export', label: '导出报告', icon: '📤' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">🎧 授权核验台</h1>
          <p className="text-sm text-gray-500 mt-1">播客素材管理系统</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                  {item.path === '/risks' && stats?.risks?.pending > 0 && (
                    <span className="ml-auto bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {stats.risks.pending}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {stats && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-sm text-gray-500 space-y-2">
              <div className="flex justify-between">
                <span>节目数</span>
                <span className="font-medium text-gray-900">{stats.programs}</span>
              </div>
              <div className="flex justify-between">
                <span>素材数</span>
                <span className="font-medium text-gray-900">{stats.materials}</span>
              </div>
              <div className="flex justify-between">
                <span>授权记录</span>
                <span className="font-medium text-gray-900">{stats.authorizations}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {navItems.find(n => n.path === location.pathname)?.label || '系统'}
            </h2>
            <button
              onClick={fetchStats}
              className="btn-secondary text-sm"
            >
              🔄 刷新
            </button>
          </div>
        </header>
        
        <div className="p-8">
          <Routes>
            <Route path="/" element={<Dashboard onStatsUpdate={fetchStats} />} />
            <Route path="/risks" element={<RiskQueue />} />
            <Route path="/import" element={<ImportPage onImportComplete={fetchStats} />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/programs/:id" element={<ProgramDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
