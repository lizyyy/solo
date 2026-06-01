import { NavLink, Outlet } from 'react-router-dom'
import { Database, Route, BarChart3, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/import', label: '数据导入', icon: Database },
  { to: '/optimize', label: '路线优化', icon: Route },
  { to: '/summary', label: '汇总追溯', icon: BarChart3 },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <aside className="flex w-56 flex-col border-r border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Compass className="h-7 w-7 text-amber-500" />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">展馆路线优化</h1>
            <p className="text-[10px] text-slate-500 leading-tight">透明 · 可追溯 · 可补录</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-700 px-5 py-4">
          <p className="text-[10px] text-slate-600">
            展馆参观路线优化系统 v1.0
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
