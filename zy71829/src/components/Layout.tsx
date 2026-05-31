import { NavLink, Outlet } from 'react-router-dom'
import { Anchor, LayoutGrid, FilePlus, ScrollText } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutGrid, label: '排队看板' },
  { to: '/submit', icon: FilePlus, label: '材料提交' },
  { to: '/audit', icon: ScrollText, label: '操作审计' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-port-surface border-r border-port-border flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-port-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-port-orange flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-port-text leading-tight">港口装卸排队</h1>
              <p className="text-xs text-port-muted">材料流转追踪</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-port-orange/15 text-port-orange'
                    : 'text-port-muted hover:bg-port-hover hover:text-port-text'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-port-border">
          <p className="text-xs text-port-muted">当前用户：负责人陈</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-port-bg">
        <Outlet />
      </main>
    </div>
  )
}
