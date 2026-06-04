import { NavLink, Outlet } from 'react-router-dom'
import { Upload, FileSearch, AlertTriangle, Clock, Shield } from 'lucide-react'

const navItems = [
  { path: '/import', label: '工况照片导入', icon: Upload },
  { path: '/review', label: '巡检备注补看', icon: FileSearch },
  { path: '/abnormal', label: '异常工况表', icon: AlertTriangle },
  { path: '/boundary-rules', label: '边界规则', icon: Shield },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-zinc-50">
      <aside className="w-56 bg-[#1B3A4B] text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <h1 className="text-sm font-bold tracking-wide leading-tight">电梯制动距离</h1>
          <h1 className="text-sm font-bold tracking-wide leading-tight">核算系统</h1>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/15 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} />
            审计追踪已启用
          </div>
          <div>所有改动可回溯证据</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
