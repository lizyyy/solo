import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileInput, ShieldCheck, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useEffect } from 'react'

const navItems = [
  { to: '/', label: '概览', icon: LayoutDashboard },
  { to: '/entry', label: '交易录入', icon: FileInput },
  { to: '/review', label: '处理复核', icon: ShieldCheck },
  { to: '/export', label: '导出报告', icon: Download },
]

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, stats, fetchStats } = useAppStore()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } bg-navy-500 text-white flex flex-col transition-all duration-300 flex-shrink-0`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-navy-400">
          {!sidebarCollapsed && (
            <span className="font-bold text-sm tracking-wide truncate">风控复核系统</span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-navy-400 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-400 font-semibold'
                    : 'text-navy-100 hover:bg-navy-600'
                }`
              }
            >
              <Icon size={20} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-t border-navy-400 text-xs text-navy-200 space-y-1">
            <div className="flex justify-between">
              <span>待复核</span>
              <span className="font-mono font-semibold">{stats.pendingCount}</span>
            </div>
            <div className="flex justify-between">
              <span>预警</span>
              <span className="font-mono font-semibold text-amber-400">{stats.warningCount}</span>
            </div>
            <div className="flex justify-between">
              <span>异常</span>
              <span className="font-mono font-semibold text-red-400">{stats.errorCount}</span>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-base font-semibold text-navy-500">虚拟卡交易风控复核</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              总交易 <strong className="font-mono text-slate-700">{stats.totalTransactions}</strong>
            </span>
            <span>
              已复核 <strong className="font-mono text-emerald-600">{stats.reviewedCount}</strong>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
