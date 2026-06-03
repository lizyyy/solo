import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Upload } from 'lucide-react';

const navItems = [
  { to: '/', label: '矩阵看板', icon: LayoutDashboard },
  { to: '/import', label: '导入补录', icon: Upload },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#0F1923]">
      <aside className="w-60 bg-[#0A1219] flex flex-col border-r border-slate-800/50">
        <div className="px-5 pt-6 pb-4">
          <h1
            className="text-lg font-bold text-white tracking-tight"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            资产减值迁徙矩阵
          </h1>
          <div className="mt-1 h-px bg-gradient-to-r from-cyan-500/60 via-blue-500/40 to-transparent" />
          <p className="mt-2 text-xs text-slate-500">风控对账工具</p>
        </div>

        <nav className="mt-2 flex-1 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? 'bg-[#1A2B3C] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-[#0F1923]'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto bg-[#0F1923] p-6">
        <Outlet />
      </main>
    </div>
  );
}
