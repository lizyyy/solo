import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  Tags,
  AlertTriangle,
  ShieldCheck,
  FileBarChart,
  History,
  Music2,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/contract-import', label: '合同导入', icon: FileUp },
  { path: '/alias-management', label: '别名管理', icon: Tags },
  { path: '/conflicts', label: '冲突处理', icon: AlertTriangle, badge: true },
  { path: '/self-check', label: '自检中心', icon: ShieldCheck },
  { path: '/weekly-report', label: '周报生成', icon: FileBarChart },
  { path: '/history', label: '历史记录', icon: History },
];

export default function Layout() {
  const location = useLocation();
  const conflicts = useAppStore((s) => s.conflicts);
  const pendingConflicts = conflicts.filter((c) => c.status === '待处理');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 tracking-tight">
                音乐社团经费报销
              </h1>
              <p className="text-[10px] text-slate-500">录音师小段工作台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const count = item.badge ? pendingConflicts.length : 0;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 group',
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-amber-400' : '')} />
                <span className="flex-1">{item.label}</span>
                {item.badge && count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      isActive
                        ? 'bg-amber-400 text-slate-800'
                        : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {count}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[11px] text-slate-500 mb-1">当前操作人</p>
            <p className="text-sm font-medium text-slate-800">录音师小段</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {navItems.find((n) => n.path === location.pathname)?.label || '音乐社团经费报销'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500">
              数据自动保存在浏览器本地
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
