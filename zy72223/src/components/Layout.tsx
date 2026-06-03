import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, ClipboardCheck, History, PanelLeftClose, PanelLeftOpen, BookOpen } from 'lucide-react'
import { useStore } from '@/store'

const navItems = [
  { to: '/', label: '看板', icon: LayoutDashboard },
  { to: '/notes', label: '补录', icon: FileText },
  { to: '/summary', label: '摘要', icon: ClipboardCheck },
  { to: '/audit-log', label: '复盘', icon: History },
]

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar } = useStore()

  return (
    <div className="flex min-h-screen bg-ledger-bg">
      <aside
        className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white border-r border-ledger-border flex flex-col transition-all duration-200 shrink-0`}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-ledger-border">
          <BookOpen className="w-5 h-5 text-ledger-amber shrink-0" />
          {!sidebarCollapsed && (
            <span className="font-serif font-semibold text-ledger-text text-base whitespace-nowrap">
              结算单拆解
            </span>
          )}
        </div>

        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ledger-amber-light text-ledger-amber'
                    : 'text-ledger-muted hover:bg-ledger-bg hover:text-ledger-text'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-ledger-border">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-ledger-muted hover:bg-ledger-bg hover:text-ledger-text transition-colors text-sm"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>收起</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
