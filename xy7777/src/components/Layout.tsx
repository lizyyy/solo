import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Map, List, Book, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/roadmap', icon: Map, label: '路线图' },
  { path: '/tasks', icon: List, label: '任务' },
  { path: '/dictionary', icon: Book, label: '词典' },
  { path: '/progress', icon: BarChart3, label: '进度' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPositionSelected } = useApp();

  const showNav = isPositionSelected && location.pathname !== '/';

  return (
    <div className="min-h-screen bg-gradient-to-b from-light to-gray-50 flex flex-col">
      <main className="flex-1 pb-20">
        {children}
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-lg mx-auto px-2">
            <div className="flex justify-around py-2">
              {navItems.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path;
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-gray-500 hover:text-primary hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 1.5} />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};

export const Header: React.FC<{
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}> = ({ title, subtitle, showBack, onBack }) => {
  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-40">
      <div className="max-w-lg mx-auto">
        {showBack && (
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-primary mb-2 flex items-center gap-1 text-sm"
          >
            ← 返回
          </button>
        )}
        <h1 className="text-xl font-bold text-dark">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};
