import { NavLink, Outlet } from 'react-router-dom'
import { Database, Upload, ShieldCheck, ScrollText } from 'lucide-react'

const navItems = [
  { to: '/', label: '台账主页', icon: Database },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/review', label: '复核', icon: ShieldCheck },
  { to: '/audit-log', label: '复盘记录', icon: ScrollText },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        <div
          className="h-14 flex items-center px-5 font-bold text-lg tracking-wide"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Database size={20} className="mr-2" style={{ color: 'var(--blue)' }} />
          <span style={{ color: 'var(--text-primary)' }}>台账系统</span>
        </div>
        <nav className="flex-1 py-3 px-3 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'font-medium' : ''
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              })}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header
          className="h-14 flex items-center px-6 text-sm flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          利息税台账管理与复核系统
        </header>
        <div className="flex-1 overflow-auto p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
