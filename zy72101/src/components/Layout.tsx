import { NavLink, Outlet } from 'react-router-dom'
import { Activity, Settings, FileText, Waves } from 'lucide-react'

const navItems = [
  { to: '/', label: '诊断看板', icon: Activity },
  { to: '/thresholds', label: '阈值管理', icon: Settings },
  { to: '/reports', label: '报告与历史', icon: FileText },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#0A1628] text-gray-100 overflow-hidden">
      <aside className="w-56 flex-shrink-0 border-r border-gray-800/60 bg-[#0D1B30] flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-gray-800/60">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Waves className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-100 leading-tight">驻波诊断</h1>
            <p className="text-[10px] text-gray-500 leading-tight">Stage SWD Tool</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800/60">
          <p className="text-[10px] text-gray-600">训练教练 · 老唐</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
