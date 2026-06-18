import { NavLink, Outlet } from 'react-router-dom'
import { ListTodo, FileUp, AlertTriangle, MapPin, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: '异常队列', icon: ListTodo, description: '查看所有异常记录' },
  { path: '/import', label: '导入记录', icon: FileUp, description: '导入船上人工记录' },
]

const quickLinks = [
  { icon: MapPin, label: '挂起队列', hint: '需人工确认的经纬度反写记录', filter: 'SUSPENDED' },
  { icon: BookOpen, label: '历史备注', hint: '查看所有人工备注记录' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-ocean-700 bg-ocean-950/80 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-ocean-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon to-neon/60 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-ocean-950" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-surface">浮标海况预警</h1>
              <p className="text-xs text-muted">海洋监测系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="text-xs font-medium text-muted px-3 mb-2 uppercase tracking-wider">功能导航</p>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-neon/15 text-neon border border-neon/30'
                    : 'text-muted hover:text-surface hover:bg-ocean-800/50 border border-transparent'
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.label}</p>
                <p className="text-xs opacity-70 truncate">{item.description}</p>
              </div>
            </NavLink>
          ))}

          <div className="mt-8 pt-6 border-t border-ocean-700">
            <p className="text-xs font-medium text-muted px-3 mb-2 uppercase tracking-wider">快速入口</p>
            {quickLinks.map((link, idx) => (
              <button
                key={idx}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted hover:text-surface hover:bg-ocean-800/50 transition-all duration-200 text-left"
              >
                <link.icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs opacity-60">{link.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-ocean-700">
          <div className="bg-ocean-800/50 rounded-lg p-4">
            <p className="text-xs text-muted mb-1">💡 接手同事</p>
            <p className="text-xs text-surface/80 leading-relaxed">
              材料在左侧【导入记录】，异常在【异常队列】，导出按钮在列表右上角。
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
