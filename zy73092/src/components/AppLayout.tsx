import { useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import {
  Package,
  History,
  Upload,
  ChevronRight,
  User,
  Building2,
  Shield,
} from 'lucide-react';
import { useTrackerStore } from '@/store/useTrackerStore';
import { cn } from '@/lib/utils';

const navItems = [
  {
    path: '/',
    label: '材料列表',
    icon: Package,
    end: true,
  },
  {
    path: '/history',
    label: '历史记录',
    icon: History,
  },
  {
    path: '/import',
    label: '送审表导入',
    icon: Upload,
  },
];

const breadcrumbMap: Record<string, string> = {
  '/': '材料列表',
  '/history': '历史记录',
  '/import': '送审表导入',
};

export default function AppLayout() {
  const location = useLocation();
  const currentRole = useTrackerStore((s) => s.currentRole);
  const toggleRole = useTrackerStore((s) => s.toggleRole);
  const [roleFlash, setRoleFlash] = useState(false);

  const handleToggleRole = () => {
    toggleRole();
    setRoleFlash(true);
    setTimeout(() => setRoleFlash(false), 600);
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const items: { label: string; path?: string }[] = [{ label: '首页', path: '/' }];

    if (path.startsWith('/material/')) {
      const id = path.split('/')[2];
      items.push({ label: '材料列表', path: '/' });
      items.push({ label: `材料详情 #${id}` });
    } else if (breadcrumbMap[path]) {
      if (path !== '/') {
        items.push({ label: breadcrumbMap[path], path });
      }
    }

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-[220px] bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 min-h-screen">
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mr-3 shadow-lg shadow-blue-900/50">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">MEP Tracker</div>
            <div className="text-[11px] text-slate-400">机电管综追踪系统</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  )
                }
              >
                <Icon className={cn('w-5 h-5 mr-3 transition-colors')} />
                <span>{item.label}</span>
                <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-3">系统状态</div>
          <div className="mx-3 flex items-center text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            数据库连接正常
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center">
                {idx > 0 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 mx-2" />
                )}
                {crumb.path ? (
                  <NavLink
                    to={crumb.path}
                    className="text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {crumb.label}
                  </NavLink>
                ) : (
                  <span className="text-slate-900 font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleToggleRole}
            className={cn(
              'relative flex items-center px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-300',
              'hover:shadow-md active:scale-[0.98]',
              currentRole === 'ENGINEER'
                ? 'bg-sky-50 border-sky-200 text-sky-700'
                : 'bg-violet-50 border-violet-200 text-violet-700',
              roleFlash && 'ring-2 ring-offset-2',
              currentRole === 'ENGINEER' && roleFlash && 'ring-sky-400',
              currentRole === 'PM' && roleFlash && 'ring-violet-400'
            )}
          >
            {currentRole === 'ENGINEER' ? (
              <>
                <User className="w-4 h-4 mr-2" />
                <span>工程师</span>
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-sky-100 text-sky-600">ENG</span>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 mr-2" />
                <span>项目经理</span>
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-violet-100 text-violet-600">PM</span>
              </>
            )}
          </button>
        </header>

        <main className="flex-1 pr-8 pl-8 py-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
