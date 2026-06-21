import { Link, Outlet, useLocation } from 'react-router-dom'
import { Home, ClipboardList, GitBranch, AlertTriangle, Download, Shell } from 'lucide-react'
import { cn } from '@/lib/utils'
import RunSelector from './RunSelector'

const navItems = [
  { path: '/', label: '报告汇总', icon: Home },
  { path: '/data-entry', label: '数据录入', icon: ClipboardList },
  { path: '/parameter-trace', label: '参数追踪', icon: GitBranch },
  { path: '/anomaly-detail', label: '异常明细', icon: AlertTriangle },
  { path: '/export', label: '报告导出', icon: Download },
]

const pageTitles: Record<string, string> = {
  '/': '报告汇总',
  '/data-entry': '数据录入',
  '/parameter-trace': '参数追踪',
  '/anomaly-detail': '异常明细',
  '/export': '报告导出',
}

export default function Layout() {
  const location = useLocation()
  const currentTitle = pageTitles[location.pathname] || '珊瑚白化报告汇总'

  return (
    <div className="flex min-h-screen relative">
      <div className="ocean-bg" />

      <aside className="w-64 bg-ocean-500/95 backdrop-blur-md border-r border-white/10 flex flex-col relative z-10 shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Shell className="w-7 h-7 text-coral-500" />
            <h1 className="font-serif text-lg text-white leading-tight">
              珊瑚白化<br />报告汇总
            </h1>
          </div>
        </div>

        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-coral-50/10 text-coral-400 border-l-[3px] border-coral-500 font-semibold'
                    : 'text-ocean-100/70 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                )}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-ocean-100/50">
            <div className="w-2 h-2 rounded-full bg-seafoam-500" />
            当前角色: 生态调查员
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 min-w-0">
        <header className="h-14 bg-ocean-500/60 backdrop-blur-md border-b border-white/10 flex items-center px-6 shrink-0 gap-4">
          <h2 className="font-serif text-white text-lg shrink-0">{currentTitle}</h2>
          <div className="w-px h-5 bg-white/10" />
          <RunSelector />
          <div className="ml-auto flex items-center gap-2 text-xs text-ocean-100/50">
            <span>首页</span>
            <span>/</span>
            <span className="text-white/80">{currentTitle}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
