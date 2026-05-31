import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, List, Upload, Download, RotateCcw } from 'lucide-react'
import { useStore } from '@/store'
import { useEffect } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '授权总览' },
  { to: '/fonts', icon: List, label: '字体列表' },
  { to: '/import', icon: Upload, label: '导入复核' },
  { to: '/export', icon: Download, label: '导出交付' },
]

export default function Layout() {
  const { init, initialized, resetWithSeed } = useStore()

  useEffect(() => {
    if (!initialized) init()
  }, [initialized, init])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-zinc-400 text-sm">正在加载数据...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <aside className="w-56 border-r border-surface-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-surface-200">
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight">字体授权追踪</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Font License Tracker</p>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-amber/10 text-amber'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-50'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-surface-200">
          <button
            onClick={resetWithSeed}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-50 rounded transition-colors w-full"
          >
            <RotateCcw size={12} />
            重置示例数据
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
