import { Link, useLocation } from 'react-router-dom';
import { Battery, Upload, BarChart3, FileText, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '数据导入', icon: Upload },
    { path: '/analysis', label: '分析仪表盘', icon: BarChart3 },
    { path: '/report', label: '报告预览', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <Battery className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  电池热失控阈值分析
                </h1>
                <p className="text-xs text-slate-400">Battery Thermal Runaway Threshold Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-md">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-slate-300">极端值不被平均 · 判断过程留痕</span>
            </div>
          </div>
        </div>
        <nav className="border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
                      ${isActive
                        ? 'text-white border-red-500 bg-slate-900/50'
                        : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700/30'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
