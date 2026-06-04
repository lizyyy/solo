import { NavLink, Outlet } from 'react-router-dom'
import { Upload, Activity, FileDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { UserRole } from '@/types'

const NAV_ITEMS = [
  { to: '/import', label: '导入与校验', icon: Upload },
  { to: '/replay', label: '参数回放', icon: Activity },
  { to: '/export', label: '导出与一致', icon: FileDown },
] as const

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'inspector', label: '质检员' },
  { value: 'engineer', label: '设备工程师' },
]

export default function Layout() {
  const currentRole = useStore((s) => s.currentRole)
  const setCurrentRole = useStore((s) => s.setCurrentRole)

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="relative flex w-60 flex-shrink-0 flex-col bg-steel-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-steel-800/40 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="px-5 pt-6 pb-4 border-b border-steel-700/50">
            <h1 className="text-lg font-bold tracking-wide text-white">
              真空泵抽速曲线
            </h1>
            <p className="mt-1 text-sm text-steel-300">管理系统</p>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-steel-800 text-white border-l-[3px] border-amber pl-[9px]'
                      : 'text-steel-300 hover:text-steel-100 hover:bg-steel-800/50'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-3 pb-5 pt-3 border-t border-steel-700/50">
            <p className="px-3 mb-2 text-xs text-steel-400">角色切换</p>
            <div className="flex gap-2">
              {ROLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setCurrentRole(value)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    currentRole === value
                      ? 'bg-amber text-white'
                      : 'bg-steel-800 text-steel-300 hover:text-steel-100 hover:bg-steel-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
