import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  Settings, 
  FileText,
  Menu,
  X,
  Heart 
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useState } from 'react';

const navItems = [
  { path: '/', label: '总览', icon: Home },
  { path: '/import', label: '数据导入', icon: Upload },
  { path: '/calendar', label: '日历热力图', icon: Calendar },
  { path: '/workouts', label: '运动详情', icon: Activity },
  { path: '/anomalies', label: '异常检测', icon: AlertTriangle },
  { path: '/settings', label: '阈值设置', icon: Settings },
  { path: '/report', label: '报告导出', icon: FileText },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">健康复盘</h1>
              <p className="text-xs text-gray-400">Apple Health Dashboard</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-500">
            版本 1.0.0
          </div>
        </div>
      </aside>
    </>
  );
};

export const Header = ({ onMenuClick }) => (
  <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 h-16 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
      <div className="hidden sm:block">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">数据看板</h2>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs text-green-700 dark:text-green-400 font-medium">已连接</span>
      </div>
    </div>
  </header>
);

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
