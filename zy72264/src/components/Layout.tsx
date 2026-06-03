import { Outlet, NavLink } from 'react-router-dom';
import { Upload, ClipboardCheck, History, Download, User } from 'lucide-react';

const navItems = [
  { to: '/import', icon: Upload, label: '导入工作台' },
  { to: '/review', icon: ClipboardCheck, label: '审阅工作台' },
  { to: '/history', icon: History, label: '变更历史' },
  { to: '/export', icon: Download, label: '导出与归档' },
];

export default function Layout() {
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

        <div className="p-4 border-t border-tunnel-border flex items-center gap-3">
          <User className="w-5 h-5 text-tunnel-muted" />
          <div>
            <p className="text-sm text-tunnel-fg font-medium">许工</p>
            <p className="text-xs text-tunnel-muted">设备工程师</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto bg-tunnel-bg">
        <Outlet />
      </main>
    </div>
  );
}
