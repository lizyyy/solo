import { NavLink, Outlet } from 'react-router-dom'
import { Clock, CalendarCheck, FileText, BookOpen } from 'lucide-react'

const navItems = [
  { to: '/timeline', label: '时间线', icon: Clock },
  { to: '/schedule', label: '排期表', icon: CalendarCheck },
  { to: '/delivery', label: '交付管理', icon: FileText },
  { to: '/guide', label: '指南', icon: BookOpen },
]

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="flex h-full w-[240px] shrink-0 flex-col bg-[#2D2D2D]">
        <div className="flex h-14 items-center px-5">
          <span className="text-sm font-semibold tracking-wide text-white">
            插画委托排期工具
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-white">
        <Outlet />
      </main>
    </div>
  )
}
