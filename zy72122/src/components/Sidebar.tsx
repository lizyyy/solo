import { NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardEdit,
  ShieldCheck,
  BarChart3,
  Clock,
  FlaskConical,
} from 'lucide-react'

const navItems = [
  { to: '/input', label: '数据录入', icon: ClipboardEdit },
  { to: '/validation', label: '校验与异常', icon: ShieldCheck },
  { to: '/charts', label: '图表可视化', icon: BarChart3 },
  { to: '/audit', label: '审计追踪', icon: Clock },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-slate-700/50 bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-700/50 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/20">
          <FlaskConical className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100">微重力弹簧</h1>
          <p className="text-[10px] text-slate-500">实验台数据处理</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                active
                  ? 'bg-orange-500/15 text-orange-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-700/50 px-4 py-3">
        <p className="text-[10px] text-slate-600">Spring Lab v1.0</p>
      </div>
    </aside>
  )
}
