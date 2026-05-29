import { NavLink } from 'react-router-dom'
import { GitBranch, Radar, Shuffle, ShieldAlert, FileText } from 'lucide-react'
import { useRiskStore } from '@/store/useRiskStore'

const navItems = [
  { to: '/lineage', label: '血缘图谱', icon: GitBranch },
  { to: '/scan', label: '影响扫描', icon: Radar },
  { to: '/alias', label: '别名归并', icon: Shuffle },
  { to: '/risk', label: '风险清单', icon: ShieldAlert },
  { to: '/report', label: '巡检报告', icon: FileText },
]

export default function Sidebar() {
  const pendingCount = useRiskStore((s) => s.stats.pending)

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-base-800 flex flex-col border-r border-base-600 z-30">
      <div className="flex items-center gap-2 px-5 h-14 shrink-0">
        <GitBranch className="w-5 h-5 text-accent" />
        <span className="font-mono text-accent font-bold text-lg tracking-wide">
          血缘追踪
        </span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-base-600 text-accent border-l-2 border-accent'
                  : 'text-muted hover:bg-base-600 hover:text-white border-l-2 border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-base-600 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {pendingCount > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-danger">
                {pendingCount}条风险
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-safe" />
              <span className="text-safe">系统正常</span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
