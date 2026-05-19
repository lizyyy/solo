import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PackageOpen,
  Wrench,
  FileCheck,
  Upload,
  FileBarChart,
  Menu,
  X,
  ChevronRight,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/pickup', icon: PackageOpen, label: '领件管理' },
  { path: '/repair', icon: Wrench, label: '返修管理' },
  { path: '/claim', icon: FileCheck, label: '索赔管理' },
  { path: '/import', icon: Upload, label: '数据导入' },
  { path: '/report', icon: FileBarChart, label: '报告中心' },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = getCurrentUser();

  const roleLabels: Record<string, string> = {
    admin: '管理员',
    engineer: '工程师',
    'claim-specialist': '索赔专员'
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-slate-800 text-lg">售后仓管理</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto lg:hidden p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                  isActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500">{roleLabels[user.role] || user.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 lg:hidden p-2 bg-white rounded-lg shadow-md border border-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-800">
              {menuItems.find((m) => m.path === location.pathname)?.label || '仪表盘'}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-slate-500">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
