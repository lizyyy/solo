import { Link, useLocation } from 'react-router-dom'
import { Upload, ClipboardCheck, FileBarChart, User } from 'lucide-react'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/review', label: '复核工作台', icon: ClipboardCheck },
  { path: '/report', label: '交接报告', icon: FileBarChart },
]

const roles = [
  { value: 'engineer', label: '实验工程师' },
  { value: 'maintenance_worker', label: '维修师傅' },
  { value: 'training_coach', label: '训练教练' },
] as const

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { currentRole, setCurrentRole } = useStore()

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-[#0C2340] text-white flex flex-col fixed h-full">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-wide">水槽波浪衰减实验</h1>
          <p className="text-slate-400 text-xs mt-1">数据管理系统</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                  active
                    ? 'bg-slate-800 text-white border-r-4 border-[#059669]'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
            <User size={14} />
            <span>当前角色</span>
          </div>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as any)}
            className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-emerald-500"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          </select>
        </div>
      </aside>

      <main className="ml-60 flex-1">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
