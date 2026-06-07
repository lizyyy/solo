import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileWarning, History, Wand2, RefreshCw } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';

const navItems = [
  { path: '/', label: '排程总览', icon: LayoutDashboard },
  { path: '/review', label: '冲突复核表', icon: FileWarning },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/wizard', label: '流程向导', icon: Wand2 },
];

export function Sidebar() {
  const resetToDemoData = useScheduleStore((s) => s.resetToDemoData);

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-lg font-serif font-bold text-primary-700 flex items-center gap-2">
          <span className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </span>
          绿道驿站补给排程
        </h1>
        <p className="text-xs text-gray-500 mt-1">街道规划工作辅助系统</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={resetToDemoData}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          重置演示数据
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">v1.0.0 · 演示版</p>
      </div>
    </div>
  );
}
