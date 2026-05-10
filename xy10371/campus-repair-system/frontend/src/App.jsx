import { useState, useEffect } from 'react'
import RepairList from './pages/RepairList'
import AssignBoard from './pages/AssignBoard'
import MaterialUsage from './pages/MaterialUsage'
import Statistics from './pages/Statistics'

function App() {
  const [currentPage, setCurrentPage] = useState('repair')
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts')
      const data = await res.json()
      setAlerts(data)
    } catch (e) {
      console.error('获取告警失败', e)
    }
  }

  const navItems = [
    { id: 'repair', label: '报修列表', icon: '📋' },
    { id: 'assign', label: '派工看板', icon: '📋' },
    { id: 'material', label: '材料领用', icon: '📦' },
    { id: 'statistics', label: '统计导出', icon: '📊' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏫</span>
              <h1 className="text-xl font-bold text-gray-900">校园宿舍报修派工台</h1>
            </div>
            {alerts.length > 0 && (
              <div className="flex items-center space-x-2">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm ${
                      alert.level === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    <span>{alert.level === 'high' ? '🚨' : '⚠️'}</span>
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <main>
          {currentPage === 'repair' && <RepairList />}
          {currentPage === 'assign' && <AssignBoard />}
          {currentPage === 'material' && <MaterialUsage />}
          {currentPage === 'statistics' && <Statistics />}
        </main>
      </div>
    </div>
  )
}

export default App
