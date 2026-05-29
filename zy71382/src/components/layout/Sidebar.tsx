import { NavLink, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, FileText, Database } from 'lucide-react'

const navItems = [
  { to: '/overview', label: '日志总览', icon: LayoutDashboard },
  { to: '/cluster/demo', label: '聚类详情', icon: Database },
  { to: '/reports', label: '报告管理', icon: FileText },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#0a0e12] border-r border-[#1e2a36] flex flex-col z-50">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[#1e2a36]">
        <Activity className="w-5 h-5 text-[#00D9A6]" />
        <span className="font-['DM_Sans'] font-bold text-sm text-white tracking-wide">
          SlowQuery
        </span>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.to === '/overview'
              ? location.pathname === '/' || location.pathname === '/overview'
              : location.pathname.startsWith(item.to.split('/').slice(0, 2).join('/'))

          return (
            <NavLink
              key={item.to}
              to={item.to === '/cluster/demo' ? `/cluster/cluster-001` : item.to}
              className={() =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#00D9A6]/10 text-[#00D9A6]'
                    : 'text-[#6b7f94] hover:bg-[#1e2a36]/60 hover:text-[#a0b3c6]'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-[#1e2a36]">
        <p className="text-[10px] text-[#3d5068] font-['JetBrains_Mono']">
          v0.1.0 · mock data
        </p>
      </div>
    </aside>
  )
}
