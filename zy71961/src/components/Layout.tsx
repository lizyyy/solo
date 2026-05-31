import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Upload, History, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: '日报总览', icon: LayoutDashboard },
  { to: '/import', label: '材料包导入', icon: Upload },
  { to: '/history', label: '变更历史', icon: History },
  { to: '/guide', label: '收尾指南', icon: BookOpen },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside
        className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-[var(--bg-tertiary)]"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex h-14 items-center border-b border-[var(--bg-tertiary)] px-5">
          <span
            className="text-base font-semibold tracking-wide"
            style={{ color: 'var(--accent-amber)' }}
          >
            模型漂移日报
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-[var(--accent-amber)] bg-[var(--bg-tertiary)] pl-[10px]'
                    : 'border-l-2 border-transparent pl-[10px] hover:bg-[var(--bg-tertiary)]',
                )
              }
              style={({ isActive }) => ({
                color: isActive
                  ? 'var(--accent-amber)'
                  : 'var(--text-secondary)',
              })}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--bg-tertiary)] p-4">
          <p
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            v1.0.0
          </p>
        </div>
      </aside>

      <main
        className="flex-1 overflow-y-auto p-6"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <Outlet />
      </main>
    </div>
  )
}
