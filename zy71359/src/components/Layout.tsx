import { NavLink, useLocation } from 'react-router-dom'
import { Flame, LayoutDashboard, Package, Users, Palette, Clock, FileText } from 'lucide-react'

const navItems = [
  { to: '/', label: '排队看板', icon: LayoutDashboard },
  { to: '/works', label: '作品管理', icon: Package },
  { to: '/students', label: '学员管理', icon: Users },
  { to: '/glazes', label: '釉料管理', icon: Palette },
  { to: '/reschedule', label: '改期记录', icon: Clock },
  { to: '/reports', label: '烧制报告', icon: FileText },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-clay-50">
      <aside className="w-56 flex-shrink-0 bg-gradient-to-b from-clay-800 to-clay-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-clay-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-kiln-400 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-base font-semibold leading-tight">窑炉排队</h1>
              <p className="text-[10px] text-clay-300 leading-tight mt-0.5">陶艺批次管理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-clay-600/80 text-white'
                    : 'text-clay-200 hover:bg-clay-700/60 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-clay-700/50">
          <p className="text-[10px] text-clay-400 text-center">本地工具 · 数据存于本机</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
