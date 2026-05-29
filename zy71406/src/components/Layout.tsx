import { NavLink, Outlet } from 'react-router-dom';
import { FileText, AlertTriangle, History, FileSpreadsheet, User } from 'lucide-react';
import { useStore } from '@/store/useStore';

const navItems = [
  { path: '/redemption-list', label: '行权名单', icon: FileText },
  { path: '/operation-logs', label: '操作回看', icon: History },
  { path: '/announcement-management', label: '公告管理', icon: FileSpreadsheet },
];

export default function Layout() {
  const { currentOperator } = useStore();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-accent-400" />
              <h1 className="text-xl font-display font-semibold tracking-wide">
                债券回售行权名单管理系统
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-primary-200">
                <User className="w-4 h-4" />
                <span>{currentOperator}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                    isActive
                      ? 'text-accent-600 border-accent-500 bg-accent-50/50'
                      : 'text-neutral-600 border-transparent hover:text-primary-700 hover:bg-neutral-50'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-neutral-200 py-4">
        <div className="max-w-[1600px] mx-auto px-6 text-center text-sm text-neutral-500">
          债券回售行权名单管理系统 · 固收运营专用 · 版本 v1.0.0
        </div>
      </footer>
    </div>
  );
}
