import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  FileText,
  BarChart3,
  History,
  FileBarChart,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/parameters', icon: Table2, label: '参数调试表' },
  { path: '/answers', icon: FileText, label: '学生答案' },
  { path: '/visualization', icon: BarChart3, label: '3D可视化' },
  { path: '/history', icon: History, label: '历史记录' },
  { path: '/reports', icon: FileBarChart, label: '报告中心' },
];

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-gradient-to-b from-slate-800 to-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="font-bold text-lg">拉格朗日乘子配餐</h1>
              <p className="text-xs text-slate-400">智能分析平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-amber-500 text-slate-900 font-medium shadow-lg shadow-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">吴</span>
            </div>
            <div>
              <p className="text-sm font-medium">吴老师</p>
              <p className="text-xs text-slate-400">教研负责人</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">
              {navItems.find(item => item.path === window.location.pathname)?.label || '仪表盘'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
