import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, History } from 'lucide-react'
import { useStore } from '@/store'
import type { UserRole } from '@/types'

const NAV_ITEMS = [
  { to: '/', label: '核算总览', icon: LayoutDashboard },
  { to: '/audit', label: '审计追溯', icon: History },
]

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'research_assistant', label: '投研助理' },
  { value: 'custody_liaison', label: '托管对接人' },
  { value: 'auditor', label: '审计人员' },
]

export default function Layout() {
  const { currentRole, setCurrentRole } = useStore()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[240px] shrink-0 flex-col" style={{ backgroundColor: '#1B2A4A' }}>
        <div className="px-6 py-6">
          <h1 className="font-serif text-xl font-bold tracking-wide text-white">
            水位线核算
          </h1>
        </div>

        <nav className="mt-2 flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-all duration-200 ${
                  isActive
                    ? 'border-l-[3px] bg-white/10 text-white'
                    : 'border-l-[3px] border-transparent text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
              style={({ isActive }) => ({
                borderLeftColor: isActive ? '#D4A843' : 'transparent',
              })}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="mb-2 px-2 text-xs text-white/40">角色切换</p>
          <div className="space-y-1">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => setCurrentRole(role.value)}
                className="w-full rounded px-3 py-2 text-left text-xs transition-all duration-200"
                style={{
                  backgroundColor: currentRole === role.value ? '#D4A843' : 'transparent',
                  color: currentRole === role.value ? '#1B2A4A' : 'rgba(255,255,255,0.6)',
                  fontWeight: currentRole === role.value ? 600 : 400,
                }}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8 scrollbar-thin" style={{ backgroundColor: '#f4f6f9' }}>
        <Outlet />
      </main>
    </div>
  )
}
