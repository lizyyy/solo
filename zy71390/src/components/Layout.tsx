import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Play,
  Users,
  FileBarChart,
  Settings,
  Bell,
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/', label: '仪表板', icon: LayoutDashboard },
  { path: '/rules', label: '规则管理', icon: FileText },
  { path: '/shadow', label: '影子演练', icon: Play },
  { path: '/customers', label: '客户分层', icon: Users },
  { path: '/reports', label: '演练报告', icon: FileBarChart },
  { path: '/settings', label: '系统设置', icon: Settings },
];

const pageTitleMap: Record<string, string> = {
  '/': '仪表板',
  '/rules': '规则管理',
  '/rules/new': '新建规则',
  '/shadow': '影子演练',
  '/customers': '客户分层',
  '/reports': '演练报告',
  '/settings': '系统设置',
};

export default function Layout() {
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState('仪表板');

  useEffect(() => {
    const path = location.pathname;
    let title = pageTitleMap[path];
    if (!title) {
      if (path.startsWith('/rules/')) {
        title = '规则详情';
      } else if (path.startsWith('/reports/')) {
        title = '报告详情';
      } else {
        title = '接口限流影子演练平台';
      }
    }
    setPageTitle(title);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen bg-dark overflow-hidden">
      <aside className="w-[240px] flex-shrink-0 bg-dark-100 border-r border-dark-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-dark-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">影子演练平台</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-white shadow-lg shadow-primary/20'
                          : 'text-slate-400 hover:text-white hover:bg-dark-200'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-dark-200">
          <div className="text-xs text-slate-500">
            版本 v1.0.0
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex-shrink-0 bg-dark-100 border-b border-dark-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-white">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-dark-200">
              <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-white">管理员</div>
                <div className="text-xs text-slate-400">admin@example.com</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
