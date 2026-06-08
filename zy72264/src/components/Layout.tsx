import { Outlet, NavLink } from 'react-router-dom';
import { Upload, ClipboardCheck, History, Download, User, Repeat } from 'lucide-react';
import { useStore } from '@/store/useStore';

const navItems = [
  { to: '/import', icon: Upload, label: '导入工作台' },
  { to: '/review', icon: ClipboardCheck, label: '审阅工作台' },
  { to: '/history', icon: History, label: '变更历史' },
  { to: '/export', icon: Download, label: '导出与归档' },
];

const roleLabels: Record<string, string> = {
  engineer: '设备工程师',
  client: '展陈客户',
};

export default function Layout() {
  const { currentUser, switchUser } = useStore();

  const toggleRole = () => {
    switchUser(currentUser.role === 'engineer' ? 'client' : 'engineer');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-tunnel-surface border-r border-tunnel-border flex flex-col">
        <div className="p-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-tunnel-accent" />
          <h1 className="text-tunnel-fg font-semibold text-lg">隧道照明暗区巡检</h1>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-tunnel-card text-tunnel-accent border-l-2 border-tunnel-accent'
                    : 'text-tunnel-muted hover:text-tunnel-fg border-l-2 border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-tunnel-border">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-tunnel-muted" />
            <div>
              <p className="text-sm text-tunnel-fg font-medium">{currentUser.name}</p>
              <p className="text-xs text-tunnel-muted">{roleLabels[currentUser.role]}</p>
            </div>
          </div>
          <button
            onClick={toggleRole}
            className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-tunnel-muted bg-tunnel-card border border-tunnel-border hover:text-tunnel-fg hover:border-tunnel-accent transition-colors w-full justify-center"
          >
            <Repeat className="w-3 h-3" />
            切换为{currentUser.role === 'engineer' ? '展陈客户' : '设备工程师'}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto bg-tunnel-bg">
        <Outlet />
      </main>
    </div>
  );
}
