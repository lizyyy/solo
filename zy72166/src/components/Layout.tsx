import { NavLink, Outlet } from 'react-router-dom'
import { Sun, LayoutDashboard, Upload, GitMerge, ClipboardCheck, FileOutput } from 'lucide-react'
import { useProjectStore } from '@/store'

const navItems = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/merge', label: '归并去重', icon: GitMerge },
  { to: '/review', label: '人工复核', icon: ClipboardCheck },
  { to: '/export', label: '公示清单', icon: FileOutput },
]

export default function Layout() {
  const { operator, setOperator } = useProjectStore()

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sun className="w-6 h-6 text-teal-700" />
            <h1
              className="text-lg font-bold text-teal-700"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              口袋公园日照复核
            </h1>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200">
          <label className="text-xs text-slate-400 mb-1 block">操作人</label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="请输入姓名"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/30 focus:border-teal-700"
          />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
