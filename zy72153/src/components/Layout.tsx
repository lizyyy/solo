import { NavLink, Outlet } from 'react-router-dom'
import { Upload, GitMerge, ClipboardCheck, FileDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/import', icon: Upload, label: '导入台' },
  { to: '/merge', icon: GitMerge, label: '归并池' },
  { to: '/review', icon: ClipboardCheck, label: '复核台' },
  { to: '/export', icon: FileDown, label: '公示清单' },
]

export default function Layout() {
  return (
    <div className="flex">
      <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-4">
          <h1 className="font-serif-title text-teal-700">海绵城市雨水花园</h1>
          <p className="text-stone-400 text-xs">审批台账管理工具</p>
        </div>
        <nav className="flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-2',
                  isActive
                    ? 'bg-teal-50 text-teal-700 border-r-2 border-teal-700'
                    : 'text-stone-500 hover:bg-stone-50'
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-stone-300">v1.0</div>
      </aside>
      <main className="ml-60 min-h-screen p-6">
        <Outlet />
      </main>
    </div>
  )
}
