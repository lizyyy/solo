import { Outlet, useLocation, Link } from 'react-router-dom'
import { Menu, ChevronRight } from 'lucide-react'
import { useStore, type UserRole } from '@/store'
import Sidebar from '@/components/Sidebar'
import { useState, useRef, useEffect } from 'react'

const breadcrumbMap: Record<string, string> = {
  '/': '仪表盘',
  '/sampling': '抽样名单',
  '/params': '参数调试',
  '/params/history': '参数变更历史',
  '/calculation': '成本计算',
  '/boundary': '边界样本',
  '/history': '变更历史',
}

const roles: UserRole[] = ['教研负责人', '学生助教', '数据录入员']

function getBreadcrumbs(pathname: string) {
  const crumbs: { label: string; to: string }[] = []
  if (pathname === '/') {
    crumbs.push({ label: '仪表盘', to: '/' })
    return crumbs
  }
  crumbs.push({ label: '仪表盘', to: '/' })
  if (pathname.startsWith('/sampling/')) {
    crumbs.push({ label: '抽样名单', to: '/sampling' })
    crumbs.push({ label: '名单详情', to: pathname })
  } else if (pathname.startsWith('/sampling')) {
    crumbs.push({ label: '抽样名单', to: '/sampling' })
  } else if (pathname === '/params/history') {
    crumbs.push({ label: '参数调试', to: '/params' })
    crumbs.push({ label: '参数变更历史', to: '/params/history' })
  } else if (pathname.startsWith('/params')) {
    crumbs.push({ label: '参数调试', to: '/params' })
  } else if (pathname.startsWith('/calculation')) {
    crumbs.push({ label: '成本计算', to: '/calculation' })
  } else if (pathname.startsWith('/boundary')) {
    crumbs.push({ label: '边界样本', to: '/boundary' })
  } else if (pathname.startsWith('/history')) {
    crumbs.push({ label: '变更历史', to: '/history' })
  }
  return crumbs
}

function RoleSelector() {
  const { userRole, setUserRole } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-bold">
          {userRole[0]}
        </span>
        {userRole}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl z-50 py-1">
          {roles.map(role => (
            <button
              key={role}
              onClick={() => { setUserRole(role); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                role === userRole ? 'text-amber-500 bg-amber-500/10' : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { sidebarOpen, setSidebarOpen } = useStore()
  const location = useLocation()
  const breadcrumbs = getBreadcrumbs(location.pathname)

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white p-1 md:hidden">
              <Menu size={20} />
            </button>
            <nav className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.to} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} className="text-slate-600" />}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-slate-300">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.to} className="text-slate-500 hover:text-amber-500 transition-colors">{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <RoleSelector />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
