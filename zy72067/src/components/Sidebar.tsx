import { useLocation, useNavigate } from 'react-router-dom'
import { Flame, LayoutDashboard, Wrench, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '总览' },
  { path: '/workbench', icon: Wrench, label: '工作台' },
  { path: '/trace', icon: FileSearch, label: '追溯与报告' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside
      className={cn(
        'group flex flex-col h-screen sticky top-0',
        'w-16 hover:w-50 transition-all duration-300 ease-in-out',
        'bg-[var(--bg-secondary)] border-r border-white/5',
        'overflow-hidden shrink-0'
      )}
    >
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5">
        <Flame className="w-6 h-6 text-amber-500 shrink-0" />
        <span
          className={cn(
            'text-amber-500 font-bold whitespace-nowrap text-lg',
            'font-[JetBrains_Mono,monospace]',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
        >
          热斑立方
        </span>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg',
                'transition-colors duration-200 cursor-pointer',
                isActive
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span
                className={cn(
                  'whitespace-nowrap text-sm',
                  'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/5">
        <span
          className={cn(
            'text-xs text-gray-500 whitespace-nowrap block truncate',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
        >
          芯片封装热斑立方-样例
        </span>
      </div>
    </aside>
  )
}
