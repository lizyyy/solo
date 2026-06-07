import { NavLink, Outlet } from 'react-router-dom';
import { Home, Upload, FileSearch, Layers, BarChart3 } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: '小看板' },
  { to: '/batch/import', icon: Upload, label: '导入灰度批次' },
  { to: '/batch/list', icon: Layers, label: '批次列表' },
  { to: '/anomalies', icon: BarChart3, label: '异常概览' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold shadow-lg">
              冷
            </div>
            <div>
              <h1 className="font-bold text-stone-800">素材标签冷启动</h1>
              <p className="text-xs text-stone-500">模型评测 · 运营复核</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-50 text-amber-900 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-100">
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-xs text-stone-500 mb-1">当前登录</p>
            <p className="text-sm font-medium text-stone-800">模型评测 · 小孟</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
