import { NavLink, Outlet } from 'react-router-dom'
import { Database, ScatterChart, GitCompare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: Database, label: '数据' },
  { to: '/cluster', icon: ScatterChart, label: '聚类' },
  { to: '/batch', icon: GitCompare, label: '批次' },
]

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-steel-dark">
      <nav className="flex w-16 flex-shrink-0 flex-col items-center bg-steel py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10">
          <span className="font-mono text-sm font-bold text-amber">M</span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-amber/10 text-amber'
                    : 'text-cold hover:bg-white/5 hover:text-sky'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber transition-all duration-200" />
                  )}
                  <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-steel px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-[10px] font-bold tracking-widest text-cold/60 [writing-mode:vertical-lr]">
            M C A
          </span>
        </div>
      </nav>

      <main className="flex-1 overflow-auto bg-steel-dark">
        <Outlet />
      </main>
    </div>
  )
}
