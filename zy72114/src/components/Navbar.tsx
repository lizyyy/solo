import { Link, useLocation } from 'react-router-dom'
import { Home, FileBarChart, FileText, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import { useProjectStore } from '@/store/projectStore'

const navItems = [
  { path: '/', label: '主工作台', icon: Home },
  { path: '/history', label: '历史对比', icon: FileBarChart },
  { path: '/report', label: '报告', icon: FileText },
]

export default function Navbar() {
  const location = useLocation()
  const currentProject = useProjectStore((state) => state.currentProject)

  return (
    <nav className="bg-white border-b-2 border-ink-200 shadow-engineering-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blueprint-600 flex items-center justify-center shadow-engineering-sm">
                <Target className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-ink-800 tracking-wide">
                校园投石机安全试算
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'eng-btn flex items-center gap-2',
                      isActive && 'eng-btn-primary'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentProject ? (
              <div className="flex items-center gap-3">
                <span className="text-ink-600 font-medium">
                  {currentProject.name}
                </span>
                <StatusBadge status={currentProject.status} size="sm" />
              </div>
            ) : (
              <span className="text-ink-400 text-sm">未加载项目</span>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
