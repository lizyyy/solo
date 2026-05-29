import { NavLink, Outlet } from 'react-router-dom'
import { Sliders, AlertTriangle, Save, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMidiStore } from '@/store/useMidiStore'

const navItems = [
  { to: '/', label: '映射工作台', icon: Sliders },
  { to: '/conflicts', label: '冲突检测', icon: AlertTriangle },
  { to: '/presets', label: '预设管理', icon: Save },
  { to: '/review', label: '复盘入口', icon: History },
]

export default function Layout() {
  const unresolvedCount = useMidiStore((s) => s.conflicts.filter((c) => !c.resolvedAt).length)

  return (
    <div className="min-h-screen bg-dark text-zinc-100 font-sans flex">
      <nav className="w-56 border-r border-zinc-800 bg-zinc-950/80 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-zinc-800">
          <h1 className="text-base font-bold tracking-wide text-neon font-mono">MIDI MAP</h1>
          <p className="text-xs text-zinc-600 mt-0.5">控制器映射看板</p>
        </div>
        <div className="flex-1 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-200',
                  isActive
                    ? 'text-neon bg-neon/5 border-r-2 border-neon'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {to === '/conflicts' && unresolvedCount > 0 && (
                <span className="ml-auto text-xs font-mono bg-critical/20 text-critical px-1.5 py-0.5 rounded-full">
                  {unresolvedCount}
                </span>
              )}
            </NavLink>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 text-xs text-zinc-700 font-mono">
          v1.0.0
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
