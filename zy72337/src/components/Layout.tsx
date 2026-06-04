import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Sliders, FileText, ShieldCheck, Presentation } from 'lucide-react'
import type { ReactNode } from 'react'

const navItems = [
  { path: '/', label: '首页', icon: LayoutDashboard },
  { path: '/params', label: '参数调试表', icon: Sliders },
  { path: '/counterexamples', label: '手算反例', icon: FileText },
  { path: '/checks', label: '自检面板', icon: ShieldCheck },
  { path: '/demo', label: '课堂演示', icon: Presentation },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 flex-shrink-0 bg-[#0f172a] border-r border-slate-700 flex flex-col">
        <div className="px-5 py-6 border-b border-slate-700">
          <h1 className="text-lg font-bold text-amber-400 tracking-wide">序列对齐歌词纠错</h1>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors border-l-4 ${
                  isActive
                    ? 'border-amber-400 text-amber-400 bg-slate-800/50'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6 bg-[#0f172a]">
        {children}
      </main>
    </div>
  )
}
