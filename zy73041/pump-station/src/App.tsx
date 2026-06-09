import React, { useState } from 'react'
import { useAppStore } from './store/AppStore'
import { AlertDashboard } from './components/AlertDashboard'
import { InspectionList } from './components/InspectionList'
import { InspectionDetail } from './components/InspectionDetail'
import {
  LayoutDashboard, ListTodo, AlertTriangle, Clock, User,
} from 'lucide-react'
import clsx from 'clsx'

type ViewMode = 'dashboard' | 'list'

function AppShell() {
  const { selectedInspectionId, setSelectedInspectionId, currentUser } = useAppStore()
  const [view, setView] = useState<ViewMode>('dashboard')

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <header className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-sm shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-slate-900 truncate">泵站巡检阈值预警</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />2026-06-09 周一早会</span>
              <span>·</span>
              <span>小宋说：交接要看到上一班改了什么</span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          <button
            onClick={() => { setView('dashboard'); setSelectedInspectionId(null) }}
            className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition',
              view === 'dashboard' && !selectedInspectionId
                ? 'bg-white text-brand-700 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700')}>
            <LayoutDashboard className="w-4 h-4" />预警仪表盘
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition',
              view === 'list' && !selectedInspectionId
                ? 'bg-white text-brand-700 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700')}>
            <ListTodo className="w-4 h-4" />巡检表
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-xs font-medium text-slate-700">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500">{currentUser.role}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {!selectedInspectionId ? (
          <div className="flex-1 min-h-0">
            {view === 'dashboard' ? <AlertDashboard /> : <InspectionList onSelect={setSelectedInspectionId} />}
          </div>
        ) : (
          <>
            <div className={clsx('min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white',
              view === 'dashboard' ? 'h-[45%] lg:h-full lg:w-[45%] xl:w-[40%]' : 'h-[45%] lg:h-full lg:w-[50%] xl:w-[55%]')}>
              {view === 'dashboard' ? <AlertDashboard /> : <InspectionList onSelect={setSelectedInspectionId} />}
            </div>
            <div className="flex-1 min-h-0 bg-white">
              <InspectionDetail />
            </div>
          </>
        )}
      </main>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-2 flex items-center justify-between gap-3 flex-wrap text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />数据保存在 localStorage · 可重置</span>
          <span>·</span>
          <span>导出CSV含口径版本与哈希，审计可复算</span>
        </div>
        <div className="flex items-center gap-3">
          <span>演示种子数据：4 条巡检 + 4 条变更 + 3 条备注 + 2 张截图</span>
          <span>·</span>
          <span>覆盖：正常/预警/超限/待确认 全部状态</span>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
