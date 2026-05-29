import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Mic, ListMusic, FileText, CheckCircle, History } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ProblemDetail from './pages/ProblemDetail'
import VersionHistory from './pages/VersionHistory'
import ReportExport from './pages/ReportExport'
import Confirmation from './pages/Confirmation'

const navItems = [
  { path: '/', label: '工作台', icon: Mic },
  { path: '/export', label: '报告导出', icon: FileText },
]

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-stage-dark border-b border-stage-border px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-amber rounded flex items-center justify-center">
              <ListMusic className="w-6 h-6 text-stage-darker" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">现场返听问题单</h1>
              <p className="text-xs text-slate-400">Live Monitor Problem Tracker</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-accent-amber text-stage-darker font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-stage-blue'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/problem/:id" element={<ProblemDetail />} />
          <Route path="/problem/:id/versions" element={<VersionHistory />} />
          <Route path="/problem/:id/history" element={<VersionHistory />} />
          <Route path="/export" element={<ReportExport />} />
          <Route path="/confirm/:id" element={<Confirmation />} />
        </Routes>
      </main>

      <footer className="bg-stage-dark border-t border-stage-border px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <History className="w-3 h-3" />
              版本追溯已启用
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-accent-green" />
              数据完整性校验通过
            </span>
          </div>
          <span>© 2024 现场音响师工作台</span>
        </div>
      </footer>
    </div>
  )
}

export default App
