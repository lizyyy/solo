import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Evaluations from './pages/Evaluations'
import EvaluationDetail from './pages/EvaluationDetail'
import Anomalies from './pages/Anomalies'
import History from './pages/History'
import ImportEvaluation from './pages/ImportEvaluation'
import CompareEvaluations from './pages/CompareEvaluations'
import ReleaseSuggestionsPage from './pages/ReleaseSuggestions'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link
      to={to}
      className={`${
        isActive
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
    >
      {children}
    </Link>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-blue-600">模型评测系统</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink to="/">概览</NavLink>
                  <NavLink to="/evaluations">评测列表</NavLink>
                  <NavLink to="/import">导入评测</NavLink>
                  <NavLink to="/compare">指标对比</NavLink>
                  <NavLink to="/anomalies">异常队列</NavLink>
                  <NavLink to="/history">历史轨迹</NavLink>
                  <NavLink to="/suggestions">发布建议</NavLink>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/evaluations/:id" element={<EvaluationDetail />} />
            <Route path="/import" element={<ImportEvaluation />} />
            <Route path="/compare" element={<CompareEvaluations />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/history" element={<History />} />
            <Route path="/suggestions" element={<ReleaseSuggestionsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
