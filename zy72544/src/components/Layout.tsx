import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, FileDown, Clock, Boxes } from 'lucide-react'

const navItems = [
  { to: '/', label: '切分记录', icon: LayoutGrid },
  { to: '/export', label: '脱敏导出', icon: FileDown },
  { to: '/history', label: '变更历史', icon: Clock },
  { to: '/visual', label: '3D/图表', icon: Boxes },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-[#12121f] border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-base font-semibold text-amber-400 tracking-wide">视频章节切分</h1>
          <p className="text-xs text-slate-500 mt-1">审核与脱敏管理</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 glow-amber'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-semibold">
              乔
            </div>
            <span>算法运营 · 小乔</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
