import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Sliders, Calculator, AlertTriangle, History, X } from 'lucide-react'
import { useStore } from '@/store'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/sampling', icon: ClipboardList, label: '抽样名单' },
  { to: '/params', icon: Sliders, label: '参数调试' },
  { to: '/calculation', icon: Calculator, label: '成本计算' },
  { to: '/boundary', icon: AlertTriangle, label: '边界样本' },
  { to: '/history', icon: History, label: '变更历史' },
]

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, userRole } = useStore()

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static z-30 h-screen w-64 bg-[#0f172a] border-r border-slate-700/50 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-amber-500 font-[var(--font-title)]" style={{ fontFamily: 'var(--font-title)' }}>
              公平分摊成本
            </h1>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white p-1 md:hidden">
            <X size={20} />
          </button>
          {!sidebarOpen && (
            <span className="text-amber-500 font-bold text-xl mx-auto" style={{ fontFamily: 'var(--font-title)' }}>公</span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
            >
              <item.icon size={20} className="shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-amber-500 text-xs font-bold">{userRole[0]}</span>
              </div>
              <div>
                <p className="text-sm text-slate-300">{userRole}</p>
                <p className="text-xs text-slate-500">当前角色</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
              <span className="text-amber-500 text-xs font-bold">{userRole[0]}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
