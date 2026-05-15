import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ChangeRequests from './pages/ChangeRequests'
import InterceptRecords from './pages/InterceptRecords'
import Schemas from './pages/Schemas'
import Consumers from './pages/Consumers'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center text-white font-bold text-xl">
                🛡️ Schema 兼容门禁
              </Link>
            </div>
            <div className="flex space-x-4">
              <Link to="/" className="flex items-center px-3 py-2 text-white hover:bg-blue-700 rounded-md">
                仪表盘
              </Link>
              <Link to="/change-requests" className="flex items-center px-3 py-2 text-white hover:bg-blue-700 rounded-md">
                变更申请
              </Link>
              <Link to="/intercept-records" className="flex items-center px-3 py-2 text-white hover:bg-blue-700 rounded-md">
                异常队列
              </Link>
              <Link to="/schemas" className="flex items-center px-3 py-2 text-white hover:bg-blue-700 rounded-md">
                Schema 管理
              </Link>
              <Link to="/consumers" className="flex items-center px-3 py-2 text-white hover:bg-blue-700 rounded-md">
                消费者
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/change-requests" element={<ChangeRequests />} />
          <Route path="/intercept-records" element={<InterceptRecords />} />
          <Route path="/schemas" element={<Schemas />} />
          <Route path="/consumers" element={<Consumers />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
