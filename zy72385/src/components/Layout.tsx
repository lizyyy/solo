import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Gauge,
  Upload,
  Calculator,
  History,
  SearchCheck,
  FileText,
  User,
  Bell,
  ChevronLeft,
  ChevronRight,
  Droplets,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Gauge, label: '仪表盘' },
  { path: '/import', icon: Upload, label: '数据导入' },
  { path: '/calculations', icon: Calculator, label: '风险计算' },
  { path: '/audit', icon: History, label: '变更审计' },
  { path: '/review', icon: SearchCheck, label: '复核工作区' },
];

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, notifications, removeNotification, reviewTasks } = useStore();
  const pendingReviews = reviewTasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside
        className={cn(
          'relative border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col transition-all duration-300',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-bold text-lg tracking-tight">泵站汽蚀</h1>
                <p className="text-xs text-slate-400">风险计算系统</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full" />
                  )}
                  <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-cyan-400')} />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {!collapsed && item.path === '/review' && pendingReviews > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                      {pendingReviews}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          {currentUser && (
            <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center')}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg">
                {currentUser.avatar}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-400">
                    {currentUser.role === 'teacher' ? '实验老师' : currentUser.role === 'inspector' ? '质检员' : '管理员'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">泵站汽蚀风险计算</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.3)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="fixed bottom-6 right-6 space-y-2 z-50">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={cn(
              'px-4 py-3 rounded-xl shadow-2xl backdrop-blur-xl border animate-slide-in flex items-center gap-3 min-w-[320px]',
              notif.type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
              notif.type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-300',
              notif.type === 'info' && 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
              notif.type === 'warning' && 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                notif.type === 'success' && 'bg-emerald-500/20',
                notif.type === 'error' && 'bg-red-500/20',
                notif.type === 'info' && 'bg-cyan-500/20',
                notif.type === 'warning' && 'bg-amber-500/20'
              )}
            >
              {notif.type === 'success' && '✓'}
              {notif.type === 'error' && '✕'}
              {notif.type === 'info' && 'ℹ'}
              {notif.type === 'warning' && '⚠'}
            </div>
            <span className="flex-1 text-sm">{notif.message}</span>
            <button
              onClick={() => removeNotification(notif.id)}
              className="text-slate-400 hover:text-slate-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
