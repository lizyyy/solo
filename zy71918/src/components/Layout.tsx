import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Mic2,
  List,
  FileSpreadsheet,
  PlusCircle,
  Radio,
} from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: List, label: '片段列表' },
    { path: '/clip/new', icon: PlusCircle, label: '新建片段' },
    { path: '/export', icon: FileSpreadsheet, label: '导出清单' },
  ];

  return (
    <div className="min-h-screen flex bg-studio-bg">
      <aside className="w-60 bg-studio-paper border-r border-studio-border flex flex-col">
        <div className="p-6 border-b border-studio-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-700 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold text-slate-850">
                播客片段管理
              </h1>
              <p className="text-xs text-studio-muted">嘉宾片段追踪系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'text-studio-muted hover:bg-studio-border hover:text-slate-850'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-studio-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-amber-50">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
              <Radio className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-850">张明</p>
              <p className="text-xs text-studio-muted">剪辑师</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
