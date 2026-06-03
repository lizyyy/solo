import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileDiff, History } from 'lucide-react'

const navItems = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/discrepancies', label: '差异清单', icon: FileDiff },
  { to: '/review', label: '复盘记录', icon: History },
]

export default function Layout() {
  return (
    <div className="flex h-screen min-w-[1280px] overflow-hidden bg-gray-50">
      <aside className="flex w-56 flex-shrink-0 flex-col bg-[var(--color-teal)] text-white">
        <div className="flex h-16 items-center gap-2 px-5 text-lg font-bold tracking-wide">
          <FileDiff className="h-6 w-6" />
          <span>差异标注系统</span>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-3">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-amber)] text-white shadow-md'
                    : 'text-teal-100 hover:bg-white/10'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-4 text-xs text-teal-200">
          衍生品确认书差异标注 v1.0
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
