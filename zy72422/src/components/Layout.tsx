import { Link, useLocation } from 'react-router-dom';
import { Disc, LayoutDashboard, Upload, BookOpen, CheckSquare, RotateCcw } from 'lucide-react';
import { useRoyaltyStore } from '../store/useRoyaltyStore';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '分账看板', icon: LayoutDashboard },
  { path: '/import', label: '合同导入', icon: Upload },
  { path: '/aliases', label: '曲目别名表', icon: BookOpen },
  { path: '/review', label: '复核工作台', icon: CheckSquare },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { resetDemoData, currentOperator } = useRoyaltyStore();

  const handleReset = () => {
    if (confirm('确定要重置为演示数据吗？所有修改将丢失。')) {
      resetDemoData();
    }
  };

  return (
    <div className="min-h-screen bg-paper paper-texture">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Disc className="w-8 h-8 text-accent-gold" />
              <h1 className="text-xl font-serif font-semibold tracking-wide">
                唱片店寄售分账
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-primary-100">
                当前用户：{currentOperator}
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-700 hover:bg-primary-600 rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置演示
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-primary-100 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-700 bg-primary-50'
                      : 'border-transparent text-primary-500 hover:text-primary-700 hover:bg-primary-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
