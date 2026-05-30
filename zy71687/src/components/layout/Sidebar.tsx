import { Link, useLocation } from 'react-router-dom'
import { Wallet, CalendarClock, AlertTriangle } from 'lucide-react'

const navItems = [
  { label: '收款归集', icon: Wallet, route: '/collection' },
  { label: '排程试算', icon: CalendarClock, route: '/scheduling' },
  { label: '预警报告', icon: AlertTriangle, route: '/alerts' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="group flex flex-col h-full bg-[#0f1219] transition-all duration-300 w-16 hover:w-[200px] overflow-hidden border-r border-white/5 shrink-0">
      <div className="flex items-center justify-center h-12 mt-2 mb-4">
        <span className="text-[#00d4aa] font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          结汇排程
        </span>
        <span className="text-[#00d4aa] font-bold text-lg absolute group-hover:opacity-0 transition-opacity duration-300">
          ¥
        </span>
      </div>

      <nav className="flex flex-col gap-1 flex-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.route
          return (
            <Link
              key={item.route}
              to={item.route}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-200 relative
                ${isActive
                  ? 'bg-[#1e2538] border-l-2 border-[#00d4aa] text-white'
                  : 'text-gray-400 hover:bg-[#1e2538] hover:text-white border-l-2 border-transparent'
                }
              `}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap text-sm">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
