import { BarChart3, Home, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: '回看列表', icon: Home },
    { path: '/dashboard', label: '数据统计', icon: BarChart3 },
    { path: '/settings', label: '参数设置', icon: Settings },
  ];

  return (
    <header className="bg-primary-800 text-white shadow-lg">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-400 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary-900" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-semibold tracking-wide">模型 A/B 灰度回看</h1>
              <p className="text-xs text-primary-300">标注复核系统 v1.0</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-accent-400 text-primary-900 shadow-md' 
                      : 'text-primary-200 hover:bg-primary-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">周姐</p>
              <p className="text-xs text-primary-300">标注负责人</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-accent-400 flex items-center justify-center text-primary-900 font-semibold text-sm">
              周
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
