import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Percent, Download, Scale } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: '审计工作台', icon: Home },
  { path: '/rate-versions', label: '费率版本', icon: Percent },
  { path: '/export', label: '审计导出', icon: Download },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-dark-surface/50 border-r border-dark-border backdrop-blur-sm fixed h-full z-10">
        <div className="p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg shadow-primary-900/30">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">费率审计</h1>
              <p className="text-xs text-dark-muted">版本追踪系统</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-card/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-border">
          <div className="p-4 bg-dark-card rounded-lg">
            <p className="text-xs text-dark-muted mb-1">演示数据</p>
            <p className="text-sm">场景1：正常流程 ✓</p>
            <p className="text-sm">场景2：异常流程 ✗</p>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
