import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, ShieldAlert, PenLine, Clock, RotateCcw } from 'lucide-react'
import { useBillStore } from '@/store/billStore'

const navItems = [
  { to: '/', label: '清单主页', icon: ClipboardList },
  { to: '/conflict', label: '冲突裁决', icon: ShieldAlert },
  { to: '/supplement', label: '补录工作台', icon: PenLine },
  { to: '/history', label: '历史记录', icon: Clock },
]

export default function Layout() {
  const conflicts = useBillStore((s) => s.conflicts)
  const items = useBillStore((s) => s.items)
  const resetData = useBillStore((s) => s.resetData)
  const unresolvedConflicts = conflicts.filter((c) => !c.resolved).length
  const riskReviewCount = items.filter((it) => it.status === 'risk_review').length

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      <aside className="w-60 flex-shrink-0 bg-navy-500 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-navy-400">
          <h1 className="text-lg font-bold tracking-tight">票据影像补录清单</h1>
          <p className="text-xs text-navy-200 mt-1">对账运营管理工具</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-400 text-white font-semibold'
                    : 'text-navy-100 hover:bg-navy-600 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === '/conflict' && unresolvedConflicts > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unresolvedConflicts}
                </span>
              )}
              {to === '/supplement' && riskReviewCount > 0 && (
                <span className="ml-auto bg-crimson-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {riskReviewCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-navy-400">
          <button
            onClick={resetData}
            className="flex items-center gap-2 text-xs text-navy-200 hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
            重置演示数据
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
