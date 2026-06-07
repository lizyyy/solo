import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Music, Users, BarChart3, Settings, UserRound, Headphones } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { getRoleLabel } from '@/utils';

export default function Layout() {
  const location = useLocation();
  const { currentRole, setCurrentRole } = useAppStore();

  const navItems = [
    { path: '/', label: '打卡概览', icon: Music },
    { path: '/stats', label: '数据统计', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 glass border-r border-primary-100 flex flex-col">
        <div className="p-6 border-b border-primary-100">
          <h1 className="font-display text-2xl font-bold text-primary-800 flex items-center gap-2">
            <Music className="w-7 h-7 text-primary-600" />
            儿童合奏课堂
          </h1>
          <p className="text-sm text-primary-600 mt-1">打卡管理系统</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                    : 'text-primary-700 hover:bg-primary-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary-100">
          <div className="text-xs text-primary-500 mb-2">当前身份</div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentRole('copyright')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                currentRole === 'copyright'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white text-primary-700 hover:bg-primary-50 border border-primary-200'
              }`}
            >
              <Users className="w-4 h-4" />
              小鹿
            </button>
            <button
              onClick={() => setCurrentRole('recorder')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                currentRole === 'recorder'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white text-primary-700 hover:bg-primary-50 border border-primary-200'
              }`}
            >
              <Headphones className="w-4 h-4" />
              录音师
            </button>
          </div>
          <p className="text-xs text-center text-primary-500 mt-3">
            当前: {getRoleLabel(currentRole)}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
