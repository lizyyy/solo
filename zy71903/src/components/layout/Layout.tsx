import { NavLink, Outlet } from 'react-router-dom';
import { Music, ListMusic, FileBarChart, AlertTriangle, PlusCircle, Home } from 'lucide-react';

const navItems = [
  { to: '/', label: '节拍记录', icon: ListMusic },
  { to: '/records/new', label: '新增记录', icon: PlusCircle },
  { to: '/mismatch', label: '错位处理', icon: AlertTriangle },
  { to: '/summary', label: '排练小结', icon: FileBarChart },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/30">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-bold text-primary-800 tracking-wide">
                  乐队走台节拍
                </h1>
                <p className="text-xs text-gray-500">专业排练节拍管理系统</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">当前用户：声部长</span>
              <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-secondary-700">张</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      <footer className="mt-auto py-6 border-t border-gray-100 bg-white/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            乐队走台节拍管理系统 · 让排练更高效
          </p>
        </div>
      </footer>
    </div>
  );
}
