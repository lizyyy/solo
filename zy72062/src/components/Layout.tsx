import { NavLink, Outlet } from 'react-router-dom'
import { Orbit, Table2, FileBarChart } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/starmap', label: '星图总览', icon: Orbit },
  { to: '/details', label: '数据明细', icon: Table2 },
  { to: '/report', label: '审计报告', icon: FileBarChart },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#0f1219] text-gray-200">
      <nav className="w-52 flex-shrink-0 flex flex-col border-r border-[#2a2f3e] bg-[#111622]">
        <div className="px-5 py-5 border-b border-[#2a2f3e]">
          <h1 className="text-lg font-bold text-[#d4a543] leading-tight">金融集团</h1>
          <p className="text-xs text-[#8b95a5] mt-0.5">股权星图</p>
        </div>
        <div className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#d4a543]/15 text-[#d4a543]'
                    : 'text-[#8b95a5] hover:bg-white/[0.04] hover:text-gray-300'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#2a2f3e] text-xs text-[#5a6478]">
          数据保存于本地浏览器
        </div>
      </nav>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
