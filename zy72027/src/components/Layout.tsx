import { NavLink, Outlet } from 'react-router-dom'
import { Gamepad2, BarChart3, Play, Download } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '操控台', icon: Gamepad2 },
  { to: '/settlement', label: '结算', icon: BarChart3 },
  { to: '/replay', label: '回放', icon: Play },
  { to: '/export', label: '导出', icon: Download },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0e27] text-gray-100 flex flex-col">
      <nav className="border-b border-purple-900/40 bg-[#0d1137]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, monospace' }}>
              量子音符弹幕
            </span>
          </div>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-purple-600/30 text-purple-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
