import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calculator, Database, GitCompare, Menu, X, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/estimate', label: '能量估算', icon: Calculator },
  { path: '/records', label: '历史记录', icon: Database },
  { path: '/compare', label: '情景对比', icon: GitCompare },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-900 via-ocean-800 to-ocean-900">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-tech-500/5 via-transparent to-transparent pointer-events-none" />

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-ocean-800/70 border-b border-ocean-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tech-500/20 to-tech-600/20 flex items-center justify-center border border-tech-500/30">
                <Waves className="w-5 h-5 text-tech-400" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg gradient-text">潮汐能发电估算</h1>
                <p className="text-xs text-gray-400">Tidal Energy Estimator</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-ocean-600 text-tech-400 shadow-lg"
                        : "text-gray-400 hover:text-white hover:bg-ocean-700/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-ocean-700/50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-ocean-500/20 animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-ocean-600 text-tech-400"
                        : "text-gray-400 hover:text-white hover:bg-ocean-700/50"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-ocean-500/20 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>潮汐能发电估算工具 v1.0 | 基于潮差、流速、设备约束综合分析系统</p>
            <p className="mt-2 text-xs text-gray-600">
              可复算ID确保相同输入产生相同结果 | 所有数据本地存储
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
