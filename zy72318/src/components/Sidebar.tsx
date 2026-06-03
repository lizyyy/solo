import { NavLink, useLocation } from 'react-router-dom'
import { PlayCircle, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '回放工作台', icon: PlayCircle },
  { to: '/conflict', label: '冲突与复核', icon: AlertTriangle },
  { to: '/check', label: '自检与导出', icon: ShieldCheck },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-base-800 border-r border-surface-border flex flex-col z-50">
      <div className="px-5 py-6 border-b border-surface-border">
        <h1 className="text-base font-semibold text-text-gold font-sans tracking-wide">VaR 回放</h1>
        <p className="text-xs text-text-muted mt-1 font-sans">风险价值复核系统</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-accent-gold/10 text-text-gold border border-surface-border-gold'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-transparent'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-accent-gold' : 'text-text-muted group-hover:text-text-secondary'} />
              <span className="font-sans">{label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto text-accent-gold/60" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center text-text-gold text-xs font-semibold font-sans">
            唐
          </div>
          <div>
            <p className="text-xs text-text-primary font-sans">唐老师</p>
            <p className="text-[10px] text-text-muted font-sans">竞赛教练</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
