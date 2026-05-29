import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, ShieldCheck } from 'lucide-react'
import OverviewPage from './pages/OverviewPage'
import DetectPage from './pages/DetectPage'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '排班总览' },
  { to: '/detect', icon: ShieldCheck, label: '检测分析' },
]

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-brand-900 flex flex-col border-r border-brand-700 shrink-0">
        <div className="p-4 border-b border-brand-700">
          <h1 className="text-lg font-semibold text-white tracking-wide">琴房排班系统</h1>
          <p className="text-xs text-brand-400 mt-1">降噪排班管理</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white border-r-2 border-amber-400'
                    : 'text-brand-300 hover:bg-brand-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-brand-700">
          <p className="text-xs text-brand-500 text-center">v1.0.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-brand-900">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/detect" element={<DetectPage />} />
        </Routes>
      </main>
    </div>
  )
}
