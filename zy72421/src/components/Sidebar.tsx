import { Music, Home, Clock, Upload, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';

const navItems = [
  { path: '/', label: '主面板', icon: Home },
  { path: '/history', label: '历史记录', icon: Clock },
];

export const Sidebar = () => {
  const location = useLocation();
  const { currentOperator } = useAppStore();

  return (
    <aside className="w-64 h-screen glass-card border-r border-white/10 flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-wine-700 to-wine-900 flex items-center justify-center">
            <Music className="text-gold-400" size={22} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-gold-300 text-shadow-gold">
              KTV 曲库
            </h1>
            <p className="text-xs text-white/50">下架复核系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-wine-800/50 text-gold-300 border border-gold-800/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-600 to-gold-800 flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{currentOperator}</p>
            <p className="text-xs text-white/50">音乐老师</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
