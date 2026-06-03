import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Upload,
  Box,
  AlertTriangle,
  CheckSquare,
  History,
  Menu,
  X,
  User,
} from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '数据导入', icon: Upload },
  { path: '/workbench', label: '标注工作台', icon: Box },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle },
  { path: '/self-check', label: '自检中心', icon: CheckSquare },
  { path: '/audit', label: '审计追踪', icon: History },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { currentUser } = useAppStore();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-blue-400 tracking-tight">
              物流车路径沙盘
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-zinc-800 rounded transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="mt-6 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                )}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <User size={16} />
            </div>
            {sidebarOpen && (
              <div>
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-zinc-500">
                  {currentUser.role === 'designer' ? '展陈设计师' : '培训学员'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main
        className={cn(
          'flex-1 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        {children}
      </main>
    </div>
  );
};
