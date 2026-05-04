import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getStats } from './services/api';
import Dashboard from './pages/Dashboard';
import Reconciliations from './pages/Reconciliations';
import Import from './pages/Import';
import Export from './pages/Export';
import Holders from './pages/Holders';
import Settings from './pages/Settings';

function App() {
  const { data: stats } = useQuery('stats', () => getStats(), {
    refetchInterval: 30000,
  });

  const navItems = [
    { path: '/', label: '仪表板', icon: '📊' },
    { path: '/reconciliations', label: '核对看板', icon: '📋' },
    { path: '/import', label: '数据导入', icon: '📥' },
    { path: '/export', label: '导出报告', icon: '📤' },
    { path: '/holders', label: '持有人', icon: '👥' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600 mr-8">
                💰 理财收益到账核对台
              </span>
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="text-gray-600 hover:text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {stats?.data && (
                <div className="hidden lg:flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    产品: {stats.data.products}
                  </span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    交易: {stats.data.transactions}
                  </span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                    核对: {stats.data.reconciliations}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reconciliations" element={<Reconciliations />} />
          <Route path="/import" element={<Import />} />
          <Route path="/export" element={<Export />} />
          <Route path="/holders" element={<Holders />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            理财收益到账核对台 · 本地运行 · 数据存储于 SQLite
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
