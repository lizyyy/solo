import { NavLink, Outlet } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckSquare,
  Download,
  HardHat,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '验收记录管理', icon: FileText },
  { path: '/self-check', label: '自检中心', icon: CheckSquare },
  { path: '/export', label: '数据导出', icon: Download },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-municipal-800 text-white px-6 py-3 shadow-md">
        <div className="flex items-center gap-3">
          <HardHat className="w-7 h-7" />
          <div>
            <h1 className="text-lg font-bold">道路开挖恢复验收系统</h1>
            <p className="text-xs text-municipal-200">市政巡检业务管理平台</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 bg-white border-r border-slate-200 py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-municipal-50 text-municipal-800 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
