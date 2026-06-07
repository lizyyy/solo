import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  FileUp,
  History,
  BarChart3,
  BookOpen,
  TreeDeciduous,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/breakpoints', label: '断点管理', icon: MapPin },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/visualization', label: '可视化', icon: BarChart3 },
  { path: '/rules', label: '边界规则', icon: BookOpen },
];

export const Layout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="w-60 bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col">
        <div className="px-5 py-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
              <TreeDeciduous className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">绿道断点</div>
              <div className="text-xs text-emerald-300">修补管理系统</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-inner'
                    : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
              付
            </div>
            <div className="text-sm">
              <div className="font-medium">市政巡检员</div>
              <div className="text-xs text-emerald-300">小付</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-200 px-8 py-4">
          <h1 className="text-xl font-bold text-stone-800">
            {navItems.find(
              (n) =>
                location.pathname === n.path ||
                (n.path !== '/' && location.pathname.startsWith(n.path))
            )?.label || '慢行绿道断点修补'}
          </h1>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
