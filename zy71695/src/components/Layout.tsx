import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '@/hooks/useAppStore'
import {
  LayoutDashboard,
  Sun,
  Mountain,
  Car,
  FileText,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/light-records', label: '光照记录', icon: Sun },
  { path: '/track-params', label: '赛道参数', icon: Mountain },
  { path: '/car-params', label: '小车参数', icon: Car },
  { path: '/estimation', label: '估算报告', icon: FileText },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        } transition-all duration-300 bg-[#1a2744] border-r border-slate-700/50 flex-shrink-0`}
      >
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Sun className="w-5 h-5 text-slate-900" />
            </div>
            <span className="font-semibold text-sm tracking-tight">太阳能小车估算</span>
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-slate-700/50 flex items-center px-4 gap-3 bg-[#1a2744]/80 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <span className="text-xs text-slate-500">赛道参数估算 · 数据可追溯</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
