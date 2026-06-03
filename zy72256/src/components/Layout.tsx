import { type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  FileText,
  History,
  Shield,
} from 'lucide-react'
import { useStore } from '@/store'
import type { OperatorRole } from '@shared/types'
import { ROLE_LABELS } from '@shared/types'

const navItems = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/review', label: '教官复核', icon: ClipboardCheck },
  { to: '/briefing', label: '班组说明', icon: FileText },
  { to: '/audit', label: '审计追踪', icon: History },
  { to: '/rules', label: '边界规则', icon: Shield },
]

export default function Layout() {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)

  return (
    <div className="flex min-h-screen">
      <aside className="sidebar">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-white text-lg font-bold leading-tight">
            校园建筑日照阴影
          </h1>
          <p className="text-white/50 text-xs mt-1">坐标原点说明审计追踪</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white border-l-3 border-[#e8943a]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white border-l-3 border-transparent'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <label className="text-white/50 text-xs block mb-2">当前角色</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OperatorRole)}
            className="w-full bg-white/10 text-white text-sm rounded-md px-3 py-2 border border-white/20 focus:outline-none focus:border-[#e8943a] appearance-none cursor-pointer"
          >
            {(Object.keys(ROLE_LABELS) as OperatorRole[]).map((r) => (
              <option key={r} value={r} className="text-gray-900">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main-content flex-1">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
