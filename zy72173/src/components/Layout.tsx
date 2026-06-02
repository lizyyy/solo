import { NavLink, Outlet } from 'react-router-dom'
import { Map, ClipboardList, Download, HardHat } from 'lucide-react'

const navItems = [
  { to: '/', label: '巡检地图', icon: Map },
  { to: '/records', label: '巡检记录', icon: ClipboardList },
  { to: '/export', label: '导出中心', icon: Download },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
              <HardHat size={18} color="#0F172A" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>导视巡检</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>何工 · 交通工程</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'font-medium'
                    : 'hover:bg-opacity-50'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? '#0F172A' : 'var(--color-text-muted)',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <div>地下空间导视巡检系统</div>
          <div className="mt-1 font-mono-data">v1.0.0</div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
