import { Link, useLocation } from 'react-router-dom';
import { Users, Calculator, AlertTriangle, FileText, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/input', label: '数据输入', icon: Users },
  { path: '/compute', label: '调座计算', icon: Calculator },
  { path: '/conflict', label: '冲突解释', icon: AlertTriangle },
  { path: '/report', label: '调座报告', icon: FileText },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-primary-700 text-white shadow-xl">
          <div className="p-6 border-b border-primary-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-400 rounded-lg flex items-center justify-center">
                <Plane className="w-6 h-6 text-primary-800" />
              </div>
              <div>
                <h1 className="font-display text-xl">座位优化</h1>
                <p className="text-xs text-primary-200">航司智能调座系统</p>
              </div>
            </div>
          </div>

          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-accent-400 text-primary-800 shadow-md'
                          : 'text-primary-100 hover:bg-primary-600 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-primary-600">
            <div className="text-xs text-primary-300 text-center">
              v1.0.0 | 二分匹配算法
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-screen">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
