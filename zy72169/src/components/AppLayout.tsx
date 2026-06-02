import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, MapPin, MessageSquare, ArrowRightLeft } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: '数据看板', icon: LayoutDashboard },
  { to: '/locations', label: '点位管理', icon: MapPin },
  { to: '/feedback', label: '反馈与方案', icon: MessageSquare },
  { to: '/data', label: '导入导出', icon: ArrowRightLeft },
]

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <h1 className="text-sm font-bold tracking-wide text-teal-400">⚡ 社区充电桩布局</h1>
          <p className="text-[10px] text-zinc-500 mt-0.5">街道工作管理工具</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-400 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600">数据存于浏览器本地</p>
          <p className="text-[10px] text-zinc-600">导出文件即可交接</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
