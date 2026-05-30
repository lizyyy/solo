import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  Settings,
  BarChart3,
  AlertTriangle,
  GitCompare,
  Download,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '工作台', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/configure', label: '参数配置', icon: Settings },
  { path: '/result', label: '结果分析', icon: BarChart3 },
  { path: '/diagnose', label: '错误诊断', icon: AlertTriangle },
  { path: '/compare', label: '版本对比', icon: GitCompare },
  { path: '/export', label: '报告导出', icon: Download },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-y-0 left-0 z-40 w-60 border-r border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">投顾再平衡</h1>
              <p className="text-xs text-slate-500">税后优化系统</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-md p-3">
            <div className="text-xs text-slate-500 mb-1">当前用户</div>
            <div className="text-sm font-medium text-slate-300">投顾张三</div>
            <div className="text-xs text-slate-500 mt-1">系统版本 v1.0.0</div>
          </div>
        </div>
      </div>

      <main className="ml-60 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
