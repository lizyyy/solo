import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  AlertTriangle,
  ClipboardCheck,
  History,
  Users,
  Database,
  Trash2
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export default function Layout() {
  const { currentUser, loadMockData, clearAllData } = useAppStore();

  const navItems = [
    { path: '/', icon: Home, label: '主工作台' },
    { path: '/conflicts', icon: AlertTriangle, label: '冲突检测' },
    { path: '/self-check', icon: ClipboardCheck, label: '自检中心' },
    { path: '/history', icon: History, label: '历史记录' },
    { path: '/name-review', icon: Users, label: '名称复核' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-sky-400">社区托育步行可达</h1>
          <p className="text-xs text-slate-400 mt-1">数据核查系统 v1.0</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white border-l-4 border-sky-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 mb-3">当前用户</div>
          <div className="text-sm font-medium text-slate-200">{currentUser}</div>
          
          <div className="mt-4 space-y-2">
            <button
              onClick={loadMockData}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              <Database size={14} />
              加载演示数据
            </button>
            <button
              onClick={clearAllData}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded transition-colors"
            >
              <Trash2 size={14} />
              清空所有数据
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
