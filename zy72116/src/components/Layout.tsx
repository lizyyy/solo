import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Upload, BarChart3, FileDown, BookOpen, Trash2 } from 'lucide-react';
import { useAnalysisStore } from '../store/analysisStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { session, clearSession } = useAnalysisStore();

  const navItems = [
    { path: '/', label: '数据导入', icon: Upload },
    { path: '/analysis', label: '数据分析', icon: BarChart3 },
    { path: '/export', label: '导出报告', icon: FileDown },
    { path: '/guide', label: '使用说明', icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">🎢</span>
                <span className="font-bold text-slate-800 hidden sm:block">游乐设施离心力提醒</span>
              </Link>
              <div className="flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {session && (
                <button
                  onClick={() => {
                    if (confirm('确定要清空当前会话吗？')) {
                      clearSession();
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="清空会话"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">清空</span>
                </button>
              )}
              {session && (
                <div className="text-sm text-slate-500 hidden md:block">
                  <span className="text-slate-400">当前：</span>
                  <span className="font-medium text-slate-700">{session.name}</span>
                  {session.hasSupplementaryNote && (
                    <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                      有补录
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="py-6 text-center text-sm text-slate-400">
        <p>游乐设施离心力提醒分析工具 · 让极端值不再被平均值掩盖</p>
      </footer>
    </div>
  );
};

export default Layout;
