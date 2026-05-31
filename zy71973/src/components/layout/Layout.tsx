import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, ListChecks, BarChart3 } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const currentUser = useRecordStore((state) => state.currentUser);
  const users = useRecordStore((state) => state.users);
  const setCurrentUser = useRecordStore((state) => state.setCurrentUser);

  const navItems = [
    { path: '/', label: '审核记录', icon: ListChecks },
    { path: '/weekly-report', label: '质检周报', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">内容审核分流系统</h1>
            </div>
            <nav className="hidden md:flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">当前用户:</span>
              <select
                value={currentUser?.id || ''}
                onChange={(e) => {
                  const user = users.find((u) => u.id === e.target.value);
                  if (user) setCurrentUser(user);
                }}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role === 'analyst' ? '运营分析师' : '业务负责人'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
