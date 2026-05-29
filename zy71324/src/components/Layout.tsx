import { NavLink, Outlet } from 'react-router-dom'
import { Database, Filter, FileBarChart } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/materials', label: '材料数据库', icon: Database },
  { to: '/screening', label: '筛选分析', icon: Filter },
  { to: '/report', label: '对比报告', icon: FileBarChart },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-[#0f1f1a]">
      <nav className="w-16 bg-[#1a2f2a] border-r border-[#2d4a3f] flex flex-col items-center pt-6 gap-2 shrink-0">
        <div className="mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#e8a838] flex items-center justify-center">
            <span className="text-[#1a2f2a] font-bold text-sm">AC</span>
          </div>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `w-11 h-11 rounded-lg flex items-center justify-center transition-all group relative ${
                isActive
                  ? 'bg-[#e8a838]/20 text-[#e8a838]'
                  : 'text-gray-500 hover:bg-[#2d4a3f] hover:text-gray-300'
              }`
            }
          >
            <item.icon size={20} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#1a2f2a] text-xs text-gray-200 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-[#2d4a3f]">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
