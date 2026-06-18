import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MapPin, Database, Waves } from 'lucide-react';

const navItems = [
  { path: '/', label: '控制台', icon: LayoutDashboard, desc: '接班速览' },
  { path: '/annotation', label: '空间标注', icon: MapPin, desc: '复核数据' },
  { path: '/data', label: '数据管理', icon: Database, desc: '导入与映射' },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-56 bg-ocean-600 text-white flex flex-col shadow-xl">
        <div className="p-5 border-b border-ocean-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-400 rounded-lg flex items-center justify-center shadow-lg">
              <Waves className="w-6 h-6 text-ocean-700" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold leading-tight">浮标海况</h1>
              <p className="text-xs text-ocean-200">空间标注系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 mx-2 my-1 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-400 text-ocean-800 shadow-md'
                    : 'text-ocean-100 hover:bg-ocean-500/50 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-xs ${'opacity-70'}`}>{item.desc}</div>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-ocean-500/30">
          <div className="text-xs text-ocean-200">
            <p>海洋站 · 值班系统</p>
            <p className="mt-1 opacity-60">v1.0.0</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 shadow-sm">
          <div className="flex-1">
            <h2 className="text-base font-medium text-slate-800">浮标海况空间标注</h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>值班员：小宋</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto ocean-pattern">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
