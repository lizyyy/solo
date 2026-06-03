import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Calculator,
  FileText,
  AlertTriangle,
  Box,
  ClipboardList,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarNavProps {
  activePath: string
}

const navItems = [
  { path: '/', label: '工作流总览', icon: LayoutDashboard },
  { path: '/import', label: '测距仪导入', icon: Upload },
  { path: '/estimation', label: '体积估算', icon: Calculator },
  { path: '/obstacles', label: '障碍物备注', icon: FileText },
  { path: '/review', label: '告警复核', icon: AlertTriangle },
  { path: '/visualization', label: '3D/图表', icon: Box },
  { path: '/report', label: '安全距离报告', icon: ClipboardList },
  { path: '/history', label: '变更历史', icon: History },
]

export default function SidebarNav({ activePath }: SidebarNavProps) {
  return (
    <nav className="w-60 flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activePath === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors',
              isActive
                ? 'bg-industrial-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
