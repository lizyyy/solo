import { ReactNode, useState } from 'react';
import {
  Home,
  Calculator,
  BookOpen,
  Database,
  FileSpreadsheet,
  History,
  Menu,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore.js';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '仪表盘', icon: Home },
  { path: '/calculator', label: '版税计算', icon: Calculator },
  { path: '/settlements', label: '结算报告', icon: FileSpreadsheet },
  { path: '/data', label: '数据管理', icon: Database },
  { path: '/audit', label: '审计追踪', icon: History },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { loading, error, setError } = useStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg mr-4"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-3">
          <BookOpen className="text-blue-600" size={28} />
          <h1 className="text-xl font-bold text-gray-800">版权版税阶梯结算系统</h1>
        </div>
        {loading && (
          <div className="ml-auto flex items-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={16} />
            <span className="text-sm">处理中...</span>
          </div>
        )}
      </header>

      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X size={18} />
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
