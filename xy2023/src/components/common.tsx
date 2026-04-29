import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Heart, BookOpen, Users, User } from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/constitution', label: '体质', icon: Heart },
  { path: '/diary', label: '日记', icon: BookOpen },
  { path: '/community', label: '分享', icon: Users },
  { path: '/profile', label: '我的', icon: User }
];

export const BottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
            >
              <Icon size={22} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export const Header: React.FC<{ title: string; showBack?: boolean; onBack?: () => void }> = ({
  title,
  showBack = false,
  onBack
}) => {
  return (
    <header className="sticky top-0 bg-white/90 backdrop-blur-sm z-40 border-b border-gray-100">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center">
        {showBack && (
          <button
            onClick={onBack}
            className="mr-3 p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-bold text-gray-800">{title}</h1>
      </div>
    </header>
  );
};

export const FeatureCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}> = ({ title, description, icon, onClick, color = 'bg-pink-50' }) => {
  return (
    <button
      onClick={onClick}
      className="card text-left w-full hover:shadow-lg transition-shadow duration-200 active:scale-98"
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <svg className="w-5 h-5 text-gray-300 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

export const EmptyState: React.FC<{ icon: string; title: string; description: string; action?: React.ReactNode }> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      {action}
    </div>
  );
};

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-pink-200 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
};

export const Badge: React.FC<{
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}> = ({ text, variant = 'primary' }) => {
  const variants = {
    primary: 'bg-pink-100 text-pink-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700'
  };

  return (
    <span className={`chip ${variants[variant]}`}>
      {text}
    </span>
  );
};
