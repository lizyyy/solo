import {
  LayoutDashboard,
  MapPin,
  MessageSquare,
  FileText,
  FileBarChart,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: '总览看板', icon: LayoutDashboard },
  { path: '/locations', label: '点位管理', icon: MapPin },
  { path: '/feedback', label: '反馈追踪', icon: MessageSquare },
  { path: '/schemes', label: '方案版本', icon: FileText },
  { path: '/reports', label: '调解报告', icon: FileBarChart },
]

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-primary-100 h-screen flex flex-col">
      <div className="p-6 border-b border-primary-100">
        <h1 className="text-lg font-bold text-primary-800">公园活动噪声调解</h1>
        <p className="text-xs text-primary-500 mt-1">市政设计审批追踪系统</p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-accent-50 text-accent-600 border-r-2 border-accent-500'
                  : 'text-primary-600 hover:bg-primary-50'
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
            曹
          </div>
          <div>
            <p className="text-sm font-medium text-primary-800">老曹</p>
            <p className="text-xs text-primary-500">市政设计师</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
