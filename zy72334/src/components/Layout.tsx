import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CheckCircle, Circle, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import TracePanel from '@/components/TracePanel'

const stepIcons: Record<string, string> = {
  '数据导入': '📥',
  '评分权重表': '⚖️',
  '降维报告': '📊',
}

export default function Layout() {
  const workflowSteps = useStore(s => s.workflowSteps)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const location = useLocation()

  const pendingCount = boundaryRecords.filter(r => r.status === 'pending_review').length

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-[#1a1a2e]">
      <aside className="flex flex-col w-64 min-w-[16rem] bg-indigo-950 border-r border-indigo-800/40">
        <div className="px-5 pt-6 pb-4">
          <h1 className="font-serif text-xl font-bold text-amber-400 tracking-wide">
            奇异值降维报告
          </h1>
          <p className="text-xs text-indigo-300/60 mt-1 font-sans">SVD Dimensionality Reduction</p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {workflowSteps.map(step => {
            const isActive = location.pathname === step.route
            return (
              <NavLink
                key={step.step}
                to={step.route}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-r-md text-sm transition-all duration-200',
                  'hover:bg-indigo-900/50',
                  isActive
                    ? 'border-l-[3px] border-amber-500 bg-indigo-900/40 text-amber-400'
                    : 'border-l-[3px] border-transparent text-indigo-200/80'
                )}
              >
                <span className="text-base">{stepIcons[step.label] ?? '📌'}</span>
                <span className={cn('font-medium', isActive && 'font-semibold')}>{step.label}</span>
                <span className="ml-auto">
                  {step.isComplete ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-amber-500/70" />
                  )}
                </span>
              </NavLink>
            )
          })}
        </nav>

        {pendingCount > 0 && (
          <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-red-900/30 border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300">
              <span className="font-bold text-red-400">{pendingCount}</span> 条待复核异常
            </span>
          </div>
        )}

        <div className="px-5 py-3 border-t border-indigo-800/30">
          <p className="text-[10px] text-indigo-400/40 font-sans">v1.0 · SVD 降维分析系统</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#1a1a2e]">
        <Outlet />
        <TracePanel />
      </main>
    </div>
  )
}
