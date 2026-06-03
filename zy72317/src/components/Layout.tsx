import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Upload, Route, Scale, GitBranch, ShieldCheck } from 'lucide-react';

const navItems = [
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/routes', label: '拣货路线明细', icon: Route },
  { path: '/weights', label: '评分权重表', icon: Scale },
  { path: '/versions', label: '参数版本', icon: GitBranch },
  { path: '/self-check', label: '自检中心', icon: ShieldCheck },
];

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
                <Route className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-bold tracking-wide">组合优化拣货路线</h1>
                <p className="text-xs text-blue-100 mt-0.5">教研数据管理平台</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-blue-200">当前用户：</span>
              <span className="font-medium">吴老师</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary-500 text-primary-600 bg-primary-50'
                        : 'border-transparent text-gray-600 hover:text-primary-500 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-xs text-gray-500">
            组合优化拣货路线管理系统 · 原始行号与人工改动全程留痕 · 单一数据源保证一致性
          </p>
        </div>
      </footer>
    </div>
  );
};
