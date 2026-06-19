import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Home,
  Layers,
  Search,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/params', icon: FileSpreadsheet, label: '参数表' },
  { to: '/samples', icon: Search, label: '样例库' },
  { to: '/review', icon: BarChart3, label: '边界复核' },
  { to: '/exceptions', icon: AlertTriangle, label: '异常队列' },
];

export default function AppLayout() {
  const loc = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-16 flex-shrink-0 bg-navy-700 text-white flex flex-col items-center py-4 gap-2">
        <div className="w-10 h-10 border-2 border-navy-300 flex items-center justify-center mb-4">
          <Layers className="w-5 h-5" />
        </div>
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={`w-12 h-12 flex items-center justify-center transition-colors
                ${active ? 'bg-navy-500 text-white' : 'text-navy-200 hover:bg-navy-600 hover:text-white'}`}
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          );
        })}
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-xl text-navy-800 font-semibold tracking-wide">
              图论路径边界复核
            </h1>
            <span className="text-xs text-slate-500 font-mono-data">数据分析小孟 · 工作台</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-mono-data">
              {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
