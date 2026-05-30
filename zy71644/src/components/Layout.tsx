import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';

const navItems = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/bonds', label: '债券管理', icon: '📋' },
  { path: '/curves', label: '曲线管理', icon: '📈' },
  { path: '/calculator', label: '计算分析', icon: '🧮' },
  { path: '/reports', label: '报告中心', icon: '📑' },
];

export default function Layout() {
  const location = useLocation();
  const { exceptions, toggleExceptionDrawer } = useAppStore();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-navy-800 text-white flex flex-col">
        <div className="p-5 border-b border-navy-700">
          <h1 className="font-serif text-lg font-bold text-gold-400">债券久期凸性</h1>
          <p className="text-xs text-navy-300 mt-1">解释器 v1.0</p>
        </div>
        
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-5 py-3 text-sm transition-colors ${
                  isActive 
                    ? 'bg-navy-700 text-gold-400 border-l-2 border-gold-400' 
                    : 'text-navy-200 hover:bg-navy-700 hover:text-white'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-navy-700">
          <p className="text-xs text-navy-400">专业固定收益分析工具</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-navy-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-navy-800">
            {navItems.find((item) => 
              location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
            )?.label || '仪表盘'}
          </h2>
          
          <button
            onClick={toggleExceptionDrawer}
            className="relative flex items-center gap-2 px-3 py-2 text-sm text-navy-600 hover:text-navy-800 transition-colors"
          >
            <span>⚠️</span>
            <span>异常提醒</span>
            {exceptions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {exceptions.length}
              </span>
            )}
          </button>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
