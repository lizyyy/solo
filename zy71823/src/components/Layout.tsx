import { NavLink, Outlet } from 'react-router-dom'
import { Activity, Search, FolderOpen, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

const NAV_ITEMS = [
  { to: '/', icon: Activity, label: '时间线总览' },
  { to: '/audit', icon: Search, label: '古城巡逻解谜' },
  { to: '/evidence', icon: FolderOpen, label: '证据管理' },
]

export default function Layout() {
  const resetData = useAppStore((s) => s.resetData)

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-5 border-b border-zinc-800">
          <h1 className="text-base font-bold tracking-wide text-zinc-50">
            证据链工具
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            社群运营对账
          </p>
        </div>
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-50 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-zinc-800">
          <button
            onClick={resetData}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw size={12} />
            重置数据
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
