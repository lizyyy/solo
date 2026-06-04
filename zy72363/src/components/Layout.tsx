import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  History,
  BarChart3,
  Bell,
  User,
  ChevronRight,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { clsx } from 'clsx'

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/sensors', label: '传感器管理', icon: Cpu },
  { path: '/review', label: '参数复核', icon: ShieldCheck },
  { path: '/history', label: '变更历史', icon: History },
  { path: '/visualization', label: '可视化分析', icon: BarChart3 },
]

const roleLabels: Record<string, string> = {
  teacher: '实验教师',
  engineer: '设备工程师',
  admin: '管理员',
}

export default function Layout() {
  const location = useLocation()
  const { currentUser, pendingReviewCount, fetchStats } = useAppStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && notifRef.current.contains(e.target as Node) === false) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentNav = navItems.find((item) => item.path === location.pathname)
  const breadcrumb = currentNav ? ['首页', currentNav.label] : ['首页']

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[240px] flex-col bg-[#1B3A4B] text-white">
        <div className="flex h-16 items-center px-6 border-b border-white/10">
          <ShieldCheck className="h-7 w-7 mr-3 text-accent" />
          <span className="text-lg font-bold tracking-wide">转速安全区管理</span>
        </div>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all duration-200',
                  active
                    ? 'bg-white/15 text-white font-medium shadow-lg'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {path === '/review' && pendingReviewCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                    {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                  </span>
                )}
                {active && <ChevronRight className="h-4 w-4" />}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-white/50">{roleLabels[currentUser.role]}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden bg-bg">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
          <div className="flex items-center gap-2 text-sm text-muted">
            {breadcrumb.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
                <span className={clsx(
                  index === breadcrumb.length - 1 ? 'text-gray-900 font-medium' : ''
                )}>
                  {item}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(notifOpen === false)}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {pendingReviewCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {pendingReviewCount > 99 ? '99+' : pendingReviewCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-white py-2 shadow-xl z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">通知</h3>
                  </div>
                  {pendingReviewCount > 0 ? (
                    <div className="px-4 py-3">
                      <p className="text-sm text-gray-700">
                        有 <span className="font-semibold text-accent">{pendingReviewCount}</span> 条安全区参数待复核
                      </p>
                      <Link
                        to="/review"
                        onClick={() => setNotifOpen(false)}
                        className="mt-2 inline-block text-sm text-primary hover:underline"
                      >
                        前往复核 →
                      </Link>
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">暂无新通知</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                <p className="text-xs text-muted">{roleLabels[currentUser.role]}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
