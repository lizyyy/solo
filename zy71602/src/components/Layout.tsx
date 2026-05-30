import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Wallet,
  ListChecks,
  FileBarChart,
  Settings,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useLimitStore } from '../store/limitStore';
import { LimitStatus } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const resetToMockData = useLimitStore((state) => state.resetToMockData);
  const walletLimits = useLimitStore((state) => state.walletLimits);

  const statusCounts = useMemo(() => {
    const counts: Record<LimitStatus, number> = {
      pending: 0,
      processing: 0,
      approved: 0,
      rejected: 0,
      to_confirm: 0,
    };
    walletLimits.forEach((w) => {
      counts[w.status]++;
    });
    return counts;
  }, [walletLimits]);

  const navItems = [
    {
      path: '/',
      label: '限额复核列表',
      icon: ListChecks,
      badge: statusCounts.pending + statusCounts.to_confirm,
    },
    {
      path: '/export',
      label: '报告导出记录',
      icon: FileBarChart,
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">数字钱包</h1>
              <p className="text-xs text-slate-400">限额复核系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <button
            onClick={resetToMockData}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">重置演示数据</span>
          </button>
          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">系统设置</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  );
};
