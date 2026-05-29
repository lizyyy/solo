import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileBarChart,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore } from '../store/uiStore';

const navItems = [
  {
    path: '/',
    label: '保险清单',
    icon: LayoutDashboard,
  },
  {
    path: '/reports',
    label: '报告导出',
    icon: FileBarChart,
  },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const location = useLocation();

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <>
      <aside
        className={cn(
        'fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 z-40',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6" />
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <h1 className="font-bold text-lg tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                    展览保险清单
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">Artwork Insurance</p>
                </div>
              )}
            </div>
          </div>

          {sidebarOpen && (
            <div className="px-4 py-3 border-b border-slate-700/50">
              <p className="text-xs text-slate-400">今日日期</p>
              <p className="text-sm font-medium text-amber-400">{today}</p>
            </div>
          )}

          <nav className="flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-amber-500/20 text-amber-400 shadow-inner'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                )}
                >
                  <Icon
                    className={cn(
                    'w-5 h-5 flex-shrink-0 transition-transform',
                    isActive ? 'scale-110' : 'group-hover:scale-105'
                  )}
                  />
                  {sidebarOpen && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-700">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
            >
              {sidebarOpen ? (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span className="text-sm">收起</span>
                </>
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
