import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, ShieldCheck } from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: '仪表盘', path: '/' },
  { icon: FileText, label: '业务线', path: '/', sub: true },
  { icon: ShieldCheck, label: '比对报告', path: '/', sub: true },
]

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-surface-800 border-r border-surface-700 flex flex-col z-30">
      <div className="px-5 py-6 border-b border-surface-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-100 leading-tight">续保报价比对</h1>
            <p className="text-[10px] text-surface-400 leading-tight">车险续保管理</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-700/60 transition-colors"
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-surface-700">
        <div className="text-[10px] text-surface-500">
          <p>演示版本 v1.0</p>
          <p className="mt-0.5">数据为模拟数据</p>
        </div>
      </div>
    </aside>
  )
}
