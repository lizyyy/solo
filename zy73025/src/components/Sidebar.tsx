import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, AlertTriangle, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  active?: string
}

const MENU_ITEMS = [
  { to: '/', label: '记录列表', Icon: ClipboardList },
  { to: '/queue', label: '异常队列', Icon: AlertTriangle },
]

export default function Sidebar({ active }: SidebarProps) {
  const location = useLocation()
  const activePath = active ?? location.pathname

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight text-slate-900">异宠温控记录复核</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {MENU_ITEMS.map(({ to, label, Icon }) => {
          const isActive = activePath === to
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px]',
                  isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-[11px] text-slate-400">v1.0.0 · 数据复核</p>
      </div>
    </aside>
  )
}
