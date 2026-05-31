import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Settings, RefreshCw } from 'lucide-react'
import { useInspectionStore } from '@/store/inspectionStore'

const navItems = [
  { to: '/dashboard', label: '巡检仪表盘', icon: LayoutDashboard },
  { to: '/ledger', label: '运行账本', icon: BookOpen },
  { to: '/guide', label: '配置与说明', icon: Settings },
]

export default function AppLayout() {
  const runInspection = useInspectionStore((s) => s.runInspection)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-indigo-950 text-white flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-indigo-900">
          <h1 className="text-lg font-bold tracking-wide">文档链接巡检</h1>
          <p className="text-xs text-indigo-300 mt-1">自动判断 · 分类账本 · 可导出</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-800 text-amber-400 font-semibold'
                    : 'text-indigo-200 hover:bg-indigo-900 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-indigo-900">
          <button
            onClick={runInspection}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-indigo-950 rounded-lg text-sm font-semibold transition-colors"
          >
            <RefreshCw size={16} />
            重新巡检
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
