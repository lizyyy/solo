import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Overview from './pages/Overview'
import ServiceDetail from './pages/ServiceDetail'
import RiskList from './pages/RiskList'
import MetricsGaps from './pages/MetricsGaps'
import Exceptions from './pages/Exceptions'

function App() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: '服务概览' },
    { path: '/risk-list', label: '风险列表' },
    { path: '/metrics-gaps', label: '指标缺口' },
    { path: '/exceptions', label: '例外审批' },
  ]
  
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">API 错误预算看板</h1>
            </div>
            
            <nav className="flex space-x-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-50 text-primary'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/risk-list" element={<RiskList />} />
          <Route path="/metrics-gaps" element={<MetricsGaps />} />
          <Route path="/exceptions" element={<Exceptions />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
