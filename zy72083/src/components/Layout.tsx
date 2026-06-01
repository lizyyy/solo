import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, Calculator, BarChart3, ChevronsLeft, ChevronsRight } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '数据录入', icon: ClipboardList },
  { to: '/compute', label: '贝叶斯计算', icon: Calculator },
  { to: '/report', label: '复盘报告', icon: BarChart3 },
] as const

export default function Layout() {
  const [expanded, setExpanded] = useState(false)
  const sidebarWidth = expanded ? 'w-60' : 'w-16'

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`${sidebarWidth} flex flex-col bg-bg-secondary border-r border-border transition-all duration-200 shrink-0`}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <span className="text-accent font-bold text-lg whitespace-nowrap">📊</span>
          {expanded && (
            <span className="text-text-primary font-bold text-lg whitespace-nowrap animate-fade-in">
              贝叶斯更新
            </span>
          )}
        </div>

        <nav className="flex-1 py-2 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium whitespace-nowrap',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                ].join(' ')
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {expanded && <span className="animate-fade-in">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors text-sm"
          >
            {expanded ? (
              <ChevronsLeft className="w-5 h-5 shrink-0" />
            ) : (
              <ChevronsRight className="w-5 h-5 shrink-0" />
            )}
            {expanded && <span className="animate-fade-in">收起侧栏</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bg-primary p-6">
        <Outlet />
      </main>
    </div>
  )
}
