import { NavLink, Outlet } from 'react-router-dom'
import { Database, BarChart3, ArrowLeftRight, FileText } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/input', label: '数据输入', icon: Database },
  { to: '/dashboard', label: '估算看板', icon: BarChart3 },
  { to: '/compare', label: '历史对比', icon: ArrowLeftRight },
  { to: '/report', label: '估算报告', icon: FileText },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-[#e2e8f0] flex">
      <nav className="w-48 shrink-0 bg-[#16213e] border-r border-[#0f3460]/60 flex flex-col">
        <div className="px-4 py-5 border-b border-[#0f3460]/40">
          <h1 className="text-sm font-bold text-[#a8d8ea] leading-tight">水泵扬程</h1>
          <h1 className="text-sm font-bold text-[#a8d8ea] leading-tight">管损估算</h1>
          <p className="text-[10px] text-[#a8d8ea]/40 mt-1">Pump Head & Pipe Loss</p>
        </div>
        <div className="flex-1 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors ${
                  isActive
                    ? 'text-[#a8d8ea] bg-[#0f3460]/50 border-r-2 border-[#a8d8ea]'
                    : 'text-[#a8d8ea]/60 hover:text-[#a8d8ea] hover:bg-[#0f3460]/20'
                }`
              }
            >
              <item.icon size={14} />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-[#0f3460]/40 text-[10px] text-[#a8d8ea]/30">
          v1.0 · 纯前端计算
        </div>
      </nav>
      <main className="flex-1 p-6 overflow-auto max-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
