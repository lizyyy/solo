import { Link, useLocation } from 'react-router-dom'
import { Anchor, FileText } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()

  const links = [
    { to: '/', label: '数据看板', icon: Anchor },
    { to: '/compare', label: '对比与报告', icon: FileText },
  ]

  return (
    <nav className="h-14 bg-harbor-panel border-b border-harbor-border flex items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3 mr-8">
        <div className="w-8 h-8 rounded bg-harbor-amber/20 flex items-center justify-center">
          <Anchor className="w-5 h-5 text-harbor-amber" />
        </div>
        <span className="font-display text-lg font-bold text-harbor-amber tracking-wide">
          港口吊机摆动抑制
        </span>
      </div>
      <div className="flex items-center gap-1">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors
                ${active
                  ? 'bg-harbor-amber/15 text-harbor-amber'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-harbor-card'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </div>
      <div className="ml-auto text-xs text-gray-500 font-mono">
        训练教练老唐专用
      </div>
    </nav>
  )
}
