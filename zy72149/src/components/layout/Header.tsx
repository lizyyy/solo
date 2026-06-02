import { Music, Upload, FileSpreadsheet, BarChart3, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '复核工作台', icon: Home },
    { path: '/import', label: '素材导入', icon: Upload },
    { path: '/report', label: '报告统计', icon: BarChart3 },
  ];

  return (
    <header className="bg-slate-800 text-white shadow-lg">
      <div className="max-w-full mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">音频素材情绪标签复核</h1>
              <p className="text-xs text-slate-400">琴房前台小温专用工具</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">当前处理人：小温</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
