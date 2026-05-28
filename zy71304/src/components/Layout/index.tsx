import { NavLink, Outlet } from 'react-router-dom';
import {
  FileInput, BarChart3, Activity, GitCompare, FileBarChart, Home } from 'lucide-react';

const navItems = [
  { path: '/', label: '参数录入', icon: FileInput },
  { path: '/analysis', label: '应力分析', icon: BarChart3 },
  { path: '/tracking', label: '问题追踪', icon: Activity },
  { path: '/compare', label: '参数对比', icon: GitCompare },
  { path: '/report', label: '报告导出', icon: FileBarChart },
];

export const Layout = () => {
  return (
    <div className="min-h-screen bg-[#0E1421]">
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">3D打印翘曲热应力分析</h1>
                <p className="text-xs text-gray-400">创客空间质量分析工具</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-center text-xs text-gray-500">
            3D打印翘曲热应力分析工具 v1.0 | 基于材料热收缩估算系统
          </p>
        </div>
      </footer>
    </div>
  );
};
