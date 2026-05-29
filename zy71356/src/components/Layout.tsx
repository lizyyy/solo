import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Grid3X3,
  History,
  FileDown,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/vendors', label: '摊主管理', icon: Users },
  { path: '/stalls', label: '摊位配置', icon: MapPin },
  { path: '/arrange', label: '排布工作台', icon: Grid3X3 },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/export', label: '报告导出', icon: FileDown },
];

export default function Layout() {
  const { conflicts, currentArrangement, lastSaveTime, loading } =
    useMarketStore();
  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-teal-400 font-serif">
            艺术市集
          </h1>
          <p className="text-sm text-slate-400 mt-1">摊位排布系统</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.path === '/arrange' && errorCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {errorCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {currentArrangement && (
          <div className="p-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 space-y-2">
              <div className="flex items-center justify-between">
                <span>当前版本</span>
                <span className="text-teal-400 font-medium">
                  {currentArrangement.version}
                </span>
              </div>
              <div className="truncate">{currentArrangement.name}</div>
              {(errorCount > 0 || warningCount > 0) && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span>
                    {errorCount} 错误 / {warningCount} 警告
                  </span>
                </div>
              )}
              {lastSaveTime && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock size={12} />
                  <span>
                    保存于{' '}
                    {new Date(lastSaveTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="p-4 bg-teal-900/30 border-t border-slate-800">
            <div className="flex items-center gap-2 text-teal-400 text-sm">
              <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              处理中...
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              {currentArrangement ? (
                <>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {currentArrangement.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    版本 {currentArrangement.version}
                  </p>
                </>
              ) : (
                <h2 className="text-lg font-semibold text-slate-800">
                  艺术市集摊位排布系统
                </h2>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
