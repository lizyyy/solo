import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  Upload,
  History,
  ShieldAlert,
  BookOpen,
  Database,
  User,
} from 'lucide-react';
import { useAppStore } from '@/store';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '复盘主界面', icon: FileText },
  { path: '/import', label: '导入数据', icon: Upload },
  { path: '/review', label: '风控复核', icon: ShieldAlert },
  { path: '/rules', label: '边界规则', icon: BookOpen },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { currentUser, resetToMockData } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-full mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  港股通汇率损益复盘
                </h1>
                <p className="text-xs text-slate-400">税费率备注证据链管理系统</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-300">
                <User className="w-4 h-4" />
                <span>当前用户: {currentUser}</span>
              </div>
              <button
                onClick={resetToMockData}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                重置演示数据
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-full mx-auto px-4">
          <div className="flex space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-4">
        <div className="max-w-full mx-auto px-4 text-center text-xs text-slate-500">
          <p>港股通汇率损益复盘系统 · 证据链完整可追溯 · 版本历史全程留痕</p>
        </div>
      </footer>
    </div>
  );
}
