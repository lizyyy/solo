import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, GitBranch, AlertTriangle, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    path: '/',
    label: '报告汇总',
    icon: LayoutDashboard,
  },
  {
    path: '/trace',
    label: '追溯分析',
    icon: GitBranch,
  },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">近岸水质</h1>
            <p className="text-xs text-slate-500">报告汇总系统</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sky-50 text-sky-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  )
                }
              >
                <Icon className="w-4.5 h-4.5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-xs font-medium text-slate-600">小宋</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">宋海洋</p>
              <p className="text-xs text-slate-500">值班员</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
