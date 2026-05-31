import { Link, useLocation } from 'react-router-dom';
import { Upload, Clock, Download, Database } from 'lucide-react';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '材料导入', icon: Upload },
    { path: '/timeline', label: '时间线', icon: Clock },
    { path: '/export', label: '导出报告', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col noise-overlay">
      <header className="border-b border-border-default bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-accent-military text-white">
              <Database size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-text-primary tracking-wide">舰队补给棋盘</h1>
              <p className="text-xs text-text-muted">Fleet Supply Board · 证据链追溯系统</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-150 border ${
                    isActive
                      ? 'bg-accent-military border-accent-military text-white'
                      : 'bg-transparent border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-border-default py-4 px-6 text-center text-xs text-text-muted">
        舰队补给棋盘 · 版本 0.1.0 · 所有数据处理在本地浏览器完成
      </footer>
    </div>
  );
};
