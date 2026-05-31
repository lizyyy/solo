import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Upload, List, Route, FileCheck, Database } from 'lucide-react';
import { useAppStore } from '@/store';
import { useEffect } from 'react';

const navItems = [
  { path: '/', label: '材料包导入', icon: Upload },
  { path: '/records', label: '记录总览', icon: List },
  { path: '/route', label: '路线规划', icon: Route },
  { path: '/review', label: '巡检单复核', icon: FileCheck },
];

export default function Layout() {
  const location = useLocation();
  const { records, loadMockData, routes } = useAppStore();

  useEffect(() => {
    if (records.length === 0) {
      loadMockData();
    }
  }, [records.length, loadMockData]);

  const pendingCount = records.filter(r => r.status === 'pending').length;

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-primary-600 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-primary-700">
          <h1 className="text-xl font-bold font-serif tracking-wide">
            展车动线预演
          </h1>
          <p className="text-xs text-primary-200 mt-1">Exhibition Route Preview</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`sidebar-link group relative ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.path === '/records' && pendingCount > 0 && (
                  <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-700">
          <div className="flex items-center space-x-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-primary-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">展厅项目</p>
              <p className="text-xs text-primary-200 truncate">
                {records.length} 条记录 · {routes.length} 个路线版本
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {navItems.find(n => n.path === location.pathname)?.label}
            </h2>
          </div>
          <div className="flex items-center space-x-3 text-sm text-slate-500">
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
