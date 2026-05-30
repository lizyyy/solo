import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ListMusic,
  Plus,
  Sliders,
  Headphones,
  Calendar,
  FileDown,
  Menu,
  X,
  Zap
} from 'lucide-react';

const navItems = [
  { path: '/', label: '需求清单', icon: ListMusic },
  { path: '/requirement/new', label: '新建需求', icon: Plus },
  { path: '/channels', label: '通道校验', icon: Sliders },
  { path: '/monitors', label: '返听配置', icon: Headphones },
  { path: '/schedule', label: '换场排程', icon: Calendar },
  { path: '/export', label: '报告导出', icon: FileDown }
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-base-900 flex">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-base-850 border-r border-base-700 flex flex-col transition-all duration-300 flex-shrink-0`}
      >
        <div className="p-4 border-b border-base-700 flex items-center justify-between">
          <div className={`flex items-center gap-2 overflow-hidden ${!sidebarOpen && 'justify-center'}`}>
            <Zap className="w-6 h-6 text-neon-purple flex-shrink-0" />
            {sidebarOpen && (
              <div>
                <h1 className="font-display font-bold text-sm uppercase tracking-wider">
                  舞台监听
                </h1>
                <p className="text-[10px] text-base-500 font-mono">STAGE MONITOR</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-base-700 rounded text-base-500 hover:text-white transition-colors flex-shrink-0"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 border-l-2 transition-all
                  ${isActive
                    ? 'border-neon-purple bg-neon-purple bg-opacity-10 text-white'
                    : 'border-transparent text-base-500 hover:bg-base-800 hover:text-white'
                  }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-mono text-sm whitespace-nowrap">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-base-700">
            <div className="text-[10px] font-mono text-base-600 space-y-1">
              <p>系统版本: v1.0.0</p>
              <p>数据存储: LocalStorage</p>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
