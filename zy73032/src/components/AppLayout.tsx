import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  CalendarDays,
  AlertTriangle,
  ScrollText,
  RefreshCw,
  User,
} from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'
import { useState } from 'react'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const stats = useReconcileStore((s) => s.stats)
  const operator = useReconcileStore((s) => s.operator)
  const setOperator = useReconcileStore((s) => s.setOperator)
  const resetDemo = useReconcileStore((s) => s.resetDemo)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(operator)

  const navItems = [
    { to: '/', label: '总览', icon: LayoutDashboard, badge: null },
    { to: '/import', label: '导入中心', icon: Upload, badge: null },
    {
      to: '/schedules',
      label: '排程明细',
      icon: CalendarDays,
      badge: stats?.pending ?? 0,
    },
    {
      to: '/anomalies',
      label: '异常追踪',
      icon: AlertTriangle,
      badge: stats?.anomalies ?? 0,
      isDanger: true,
    },
    { to: '/logs', label: '操作日志', icon: ScrollText, badge: null },
  ]

  const handleSaveOperator = () => {
    if (editName.trim()) {
      setOperator(editName.trim())
    }
    setEditing(false)
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-r border-warm-200 flex flex-col">
        <div className="p-5 border-b border-warm-100">
          <h1 className="font-serif text-xl font-bold text-warm-800">
            训练课排程对账
          </h1>
          <p className="text-xs text-warm-500 mt-1">救助站 · 小乔工作台</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`nav-link relative ${isActive ? 'nav-link-active' : ''}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge !== null && item.badge > 0 && (
                  <span
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      item.isDanger
                        ? 'bg-danger-100 text-danger-700'
                        : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-3 border-t border-warm-100 space-y-2">
          <div className="flex items-center gap-2">
            <User size={16} className="text-warm-500" />
            {editing ? (
              <input
                className="input flex-1 text-xs"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveOperator}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveOperator()}
                autoFocus
              />
            ) : (
              <button
                className="text-sm text-warm-700 hover:text-brand-700 flex-1 text-left"
                onClick={() => {
                  setEditName(operator)
                  setEditing(true)
                }}
              >
                操作人：{operator}
              </button>
            )}
          </div>
          <button
            className="btn-ghost w-full text-xs"
            onClick={() => {
              if (confirm('确定要重置为演示数据吗？')) {
                resetDemo()
              }
            }}
          >
            <RefreshCw size={14} />
            重置演示数据
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-warm-200 px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-warm-800">
              {navItems.find(
                (n) =>
                  (n.to === '/' && location.pathname === '/') ||
                  (n.to !== '/' && location.pathname.startsWith(n.to)),
              )?.label || '总览'}
            </h2>
          </div>
          <div className="text-sm text-warm-500">
            {stats ? (
              <>
                正常排程 <span className="font-medium text-warm-700">{stats.total_normal_schedules}</span> 条 ·
                {' '}已确认 <span className="font-medium text-success-700">{stats.confirmed}</span> ·
                {' '}异常 <span className="font-medium text-danger-700">{stats.anomalies}</span>
              </>
            ) : (
              '加载中...'
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
