import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, FileCode, BarChart3, Settings, Home } from 'lucide-react';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: '总览' },
    { path: '/batches', icon: BarChart3, label: '预演批次' },
    { path: '/scripts', icon: FileCode, label: '迁移脚本' },
    { path: '/databases', icon: Database, label: '目标数据库' },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">数据库迁移预演</h1>
          <p className="text-sm text-gray-500 mt-1">DB Migration Preview</p>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
