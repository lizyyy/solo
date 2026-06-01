import { NavLink, Outlet } from 'react-router-dom'
import {
  Upload,
  Route,
  GitCompareArrows,
  FileBarChart,
  ThermometerSnowflake,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/allocation', label: '路线分配', icon: Route },
  { to: '/conflict', label: '冲突裁决', icon: GitCompareArrows },
  { to: '/report', label: '报告导出', icon: FileBarChart },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6F8]">
      <aside className="w-56 flex-shrink-0 bg-navy-950 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
            <ThermometerSnowflake className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-sm font-bold leading-tight">冷链路线</h1>
            <p className="text-teal-500 text-[10px] font-medium tracking-wider">COLD CHAIN</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-950 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-slate-500 text-[10px] text-center">
            仓库冷链路线分配系统 v1.0
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
