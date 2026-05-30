import { Link, useLocation } from 'react-router-dom'
import {
  Archive,
  Search,
  GitCompare,
  AlertTriangle,
  BarChart3,
  Download,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/archive', label: '提示词归档', icon: Archive },
  { to: '/search', label: '相似检索', icon: Search },
  { to: '/compare', label: '版本对比', icon: GitCompare },
  { to: '/issues', label: '问题追踪', icon: AlertTriangle },
  { to: '/dashboard', label: '数据看板', icon: BarChart3 },
  { to: '/export', label: '报告导出', icon: Download },
]

interface SidebarProps {
  collapsed?: boolean
}

export default function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'h-screen bg-bg-lighter border-r border-bg-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="h-16 flex items-center gap-3 px-4 border-b border-bg-border">
        <div className="w-8 h-8 rounded-lg bg-brand-amber flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-black" />
        </div>
        {!collapsed && (
          <span className="font-mono font-bold text-lg text-brand-amber whitespace-nowrap">
            提示词仓库
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            location.pathname === item.to ||
            location.pathname.startsWith(item.to + '/')

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-amber/15 text-brand-amber'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-bg-border">
          <div className="text-xs text-gray-500">版本 1.0.0</div>
        </div>
      )}
    </aside>
  )
}
