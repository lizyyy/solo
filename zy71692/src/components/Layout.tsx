import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Users, FileText, BarChart3 } from 'lucide-react'

const navItems = [
  { to: '/', label: '课堂', icon: Activity },
  { to: '/analysis', label: '角度分析', icon: BarChart3 },
  { to: '/students', label: '学生管理', icon: Users },
  { to: '/report', label: '课堂报告', icon: FileText },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <nav className="w-16 flex flex-col items-center py-4 gap-2 bg-gray-900 border-r border-gray-800">
        <div className="text-teal-400 font-bold text-lg mb-4">角</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-colors ${
                isActive
                  ? 'bg-teal-600/20 text-teal-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
