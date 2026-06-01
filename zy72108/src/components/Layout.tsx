import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Microscope, History, Music } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/review', icon: Microscope, label: '复核工作台' },
  { to: '/history', icon: History, label: '历史对比' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-surface-raised border-r border-surface-border flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
              <Music className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-100 leading-tight">琴弦张力复核</h1>
              <p className="text-[10px] text-gray-500 font-mono">Violin String Tension</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                  isActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-overlay'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-surface-border">
          <p className="text-[10px] text-gray-600 font-mono">v1.0 · 小提琴琴弦张力复核</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
