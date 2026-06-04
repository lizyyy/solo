import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  GitCompare,
  BarChart3,
  FileText,
  User,
} from 'lucide-react'
import { useAppStore } from '@/store'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/import', icon: Upload, label: '数据导入' },
  { to: '/review', icon: ClipboardCheck, label: '数据复核' },
  { to: '/history', icon: GitCompare, label: '变更历史' },
  { to: '/visualization', icon: BarChart3, label: '可视化展示' },
  { to: '/report', icon: FileText, label: '报告生成' },
]

export default function Layout() {
  const currentOperator = useAppStore((s) => s.currentOperator)

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-64 flex-shrink-0 flex-col bg-primary text-white">
        <div className="px-6 pt-8 pb-6">
          <h1 className="font-heading text-xl font-bold tracking-wide">
            座位安排复核
          </h1>
          <div className="mt-1 h-0.5 w-12 rounded bg-accent" />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-accent bg-primary-light text-white'
                    : 'text-slate-300 hover:bg-primary-light hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-600 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <User size={16} />
            <span>{currentOperator || '未登录'}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-bgPage p-8">
        <Outlet />
      </main>
    </div>
  )
}
