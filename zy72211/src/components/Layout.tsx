import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Scale,
  ClipboardList,
  FileText,
  RotateCcw,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '试算总览' },
  { to: '/import', icon: Upload, label: '数据导入' },
  { to: '/conflict', icon: Scale, label: '冲突裁决' },
  { to: '/audit', icon: ClipboardList, label: '审核追踪' },
  { to: '/summary', icon: FileText, label: '负责人摘要' },
]

export default function Layout() {
  const conflictCount = useStore((s) => s.conflicts.filter((c) => c.resolution === '待裁决').length)
  const riskCount = useStore((s) => s.records.filter((r) => r.status === '待风控复核').length)
  const resetToSample = useStore((s) => s.resetToSample)

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 flex-shrink-0 bg-[#1a365d] text-white flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            ABS 现金流瀑布试算
          </h1>
          <p className="text-xs text-blue-200 mt-1">双源证据合一 · 冲突不自动拍板</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white font-medium shadow-sm'
                    : 'text-blue-200 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.to === '/conflict' && conflictCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {conflictCount}
                </span>
              )}
              {item.to === '/' && riskCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {riskCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={resetToSample}
            className="flex items-center gap-2 text-blue-300 hover:text-white text-xs transition-colors w-full justify-center"
          >
            <RotateCcw size={14} />
            恢复样例数据
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
