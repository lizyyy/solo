import { ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, Upload, FileText, AlertTriangle, ClipboardCheck, ClipboardList, Presentation } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StepIndicator from './StepIndicator'

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/import', label: '问卷导入', icon: Upload },
  { path: '/boundary', label: '边界值说明', icon: FileText },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { path: '/review', label: '数据复核', icon: ClipboardCheck },
  { path: '/audit', label: '审计日志', icon: ClipboardList },
  { path: '/demo', label: '课堂演示', icon: Presentation },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const currentStep = useStore((s) => s.currentStep)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-700/50 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700/50">
          <h1 className="font-serif text-lg font-bold text-amber-500 tracking-wide">
            多目标评分权重调参
          </h1>
          <p className="text-xs text-slate-500 mt-1">Multi-Objective Scoring Tuner</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-amber-500' : ''} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500">
            当前批次: <span className="text-slate-300">{useStore.getState().batchId || '未导入'}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex-shrink-0 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center px-6">
          <StepIndicator currentStep={currentStep} />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
