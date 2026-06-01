import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, BarChart3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/input', label: '数据录入', icon: ClipboardList },
  { to: '/dashboard', label: '频谱看板', icon: BarChart3 },
  { to: '/report', label: '分析报告', icon: FileText },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#1a1d23]">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/5 bg-[#1a1d23]">
        <div className="px-5 py-6">
          <h1 className="text-lg font-bold text-zinc-100">压缩机振动频谱分析</h1>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 px-5 py-4">
          <p className="text-xs text-zinc-600">v1.0.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#1a1d23] p-6">
        <Outlet />
      </main>
    </div>
  );
}
