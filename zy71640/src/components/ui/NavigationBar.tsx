import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, Upload, FileText } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: '展厅', icon: LayoutGrid },
  { path: '/import', label: '导入', icon: Upload },
  { path: '/report', label: '报告', icon: FileText },
]

export function NavigationBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-2xl bg-[#16213e]/90 px-2 py-1.5 border border-zinc-700/40 backdrop-blur-sm shadow-xl">
      {NAV_ITEMS.map((item) => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs transition-colors ${
              active
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-zinc-400 hover:bg-zinc-700/40 hover:text-zinc-200'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
