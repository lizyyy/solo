import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, RefreshCw, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/callbacks', label: 'Callbacks', icon: FileText },
  { to: '/replay', label: 'Replay', icon: RefreshCw },
  { to: '/report', label: 'Report', icon: ClipboardCheck },
]

export default function Sidebar() {
  return (
    <aside
      className="sticky top-0 h-screen flex flex-col border-r border-[var(--color-border)]"
      style={{ width: 240, background: 'var(--color-bg-primary)' }}
    >
      <div className="px-5 py-6 border-b border-[var(--color-border)]">
        <h1 className="font-mono text-lg font-bold tracking-tight text-[var(--color-amber)]">
          Webhook Audit
        </h1>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors border-l-2',
                isActive
                  ? 'border-[var(--color-amber)] text-[var(--color-amber)] bg-[var(--color-bg-secondary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)] font-mono">v1.0.0</p>
      </div>
    </aside>
  )
}
