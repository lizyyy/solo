import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import ImportPage from '@/pages/ImportPage'
import SupplementPage from '@/pages/SupplementPage'
import ReconciliationPage from '@/pages/ReconciliationPage'
import { Activity, MailPlus, ShieldCheck } from 'lucide-react'

const navItems = [
  { path: '/import', label: '导入与自检', icon: Activity },
  { path: '/supplement', label: '补录与冲突', icon: MailPlus },
  { path: '/reconciliation', label: '差异清单与复核', icon: ShieldCheck },
]

function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-900">
      <nav className="w-56 shrink-0 border-r border-slate-700/50 bg-slate-800/60 p-4">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
            <Activity className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-tight">场外期权</div>
            <div className="text-[10px] text-amber-400/80 leading-tight">敲入监测</div>
          </div>
        </div>
        <div className="space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/import" element={<ImportPage />} />
          <Route path="/supplement" element={<SupplementPage />} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="*" element={<Navigate to="/import" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Layout />
    </Router>
  )
}
