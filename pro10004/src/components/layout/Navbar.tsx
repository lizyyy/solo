import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitCompare, History, Globe2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: '筛查概览', icon: LayoutDashboard },
  { path: '/compare', label: '版本对比', icon: GitCompare },
  { path: '/history', label: '历史版本', icon: History }
];

export const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-700">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">跨境汇款筛查回放</h1>
              <p className="text-xs text-slate-400">Cross-border Remittance Screening</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">财务复核系统</span>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
              财
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
