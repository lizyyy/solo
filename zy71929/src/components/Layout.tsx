import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  AlertTriangle,
  Download,
  User,
  Menu,
  X,
  Palette,
} from 'lucide-react';
import { useAppStore } from '@/store';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '任务列表', icon: LayoutDashboard },
  { path: '/pending', label: '待处理中心', icon: AlertTriangle },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const currentUser = useAppStore((state) => state.currentUser);
  const tasks = useAppStore((state) => state.tasks);
  const pendingTasks = tasks.filter((t) => t.status === 'pending');

  return (
    <div className="flex h-screen bg-charcoal-300">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-charcoal-400 border-r border-charcoal-200/50 transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-charcoal-200/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gold-300 to-gold-500 rounded-md flex items-center justify-center">
              <Palette className="w-6 h-6 text-charcoal-500" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-serif font-bold text-gradient-gold text-lg">
                  数字艺术投屏
                </h1>
                <p className="text-xs text-ivory-400">管理系统</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-charcoal-300 rounded-md transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-ivory-300" />
            ) : (
              <Menu className="w-5 h-5 text-ivory-300" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 ${
                  isActive
                    ? 'bg-gold-300/10 text-gold-300 border border-gold-300/30'
                    : 'text-ivory-300 hover:bg-charcoal-300/50 hover:text-ivory-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium flex-1">{item.label}</span>
                )}
                {sidebarOpen && item.path === '/pending' && pendingTasks.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingTasks.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-charcoal-200/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-forest-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-ivory-200" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ivory-100 truncate">
                  {currentUser.name}
                </p>
                <p className="text-xs text-ivory-400">
                  {currentUser.role === 'curator' ? '策展人' : '画廊助理'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-charcoal-400/50 border-b border-charcoal-200/30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="font-serif text-xl text-ivory-100">
              {location.pathname === '/' && '投屏任务列表'}
              {location.pathname === '/pending' && '待处理中心'}
              {location.pathname.startsWith('/tasks/') && '任务详情'}
              {location.pathname.startsWith('/export/') && '导出复核'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-ivory-400">
              <Clock className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
