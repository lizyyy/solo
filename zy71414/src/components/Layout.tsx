import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  List,
  Menu,
  X,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const resetToMockData = useAppStore((state) => state.resetToMockData);

  const navItems = [
    { path: '/', label: '申请列表', icon: List },
    { path: '/application/new', label: '新建申请', icon: FilePlus },
  ];

  const handleReset = () => {
    if (confirm('确定要重置所有数据到初始状态吗？')) {
      resetToMockData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-900 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-primary-800 rounded transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <LayoutDashboard size={24} />
              <h1 className="text-lg font-bold">供应链动态折扣付款系统</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-800 hover:bg-primary-700 rounded transition-colors"
            >
              <RotateCcw size={14} />
              重置数据
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-57px)]">
            <nav className="p-4">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    (item.path === '/' && location.pathname === '/') ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        )}

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
