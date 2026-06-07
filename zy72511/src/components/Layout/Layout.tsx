import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  Clock,
  AlertTriangle,
  BarChart3,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '归因分析', icon: Home },
  { path: '/review', label: '产品复盘', icon: BarChart3 },
  { path: '/history', label: '历史记录', icon: Clock },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle }
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { resetToInitial, currentUser } = useStore();

  const handleReset = () => {
    if (confirm('确定要重置所有数据到初始状态吗？')) {
      resetToInitial();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            语音转写错词归因
          </h1>
          <p className="text-xs text-slate-400 mt-1">归因分析系统</p>
        </div>

        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2">
            <p className="text-xs text-slate-400">当前用户</p>
            <p className="text-sm font-medium">{currentUser.name}</p>
            <p className="text-xs text-slate-400">{currentUser.role}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <RotateCcw size={14} />
            重置数据
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-600" />
            <span className="text-sm text-slate-600">
              {navItems.find((item) => item.path === location.pathname)?.label || '归因分析'}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            三步流程：脱敏规则导入 → 补看灰度批次 → 产品复盘更新
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
