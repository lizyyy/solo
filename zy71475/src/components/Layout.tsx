import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Guitar, ClipboardList, Music } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { path: '/', label: '模态工作台', icon: Guitar },
  { path: '/records', label: '记录管理', icon: ClipboardList },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col bg-[#F5F0EB]">
      <header className="flex items-center gap-4 border-b border-stone-200 bg-[#3E2723] px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Music className="h-6 w-6 text-[#D4A84B]" />
          <h1 className="text-lg font-semibold text-[#FFFDF8] tracking-wide">吉他共鸣箱模态</h1>
        </div>
        <span className="text-xs text-stone-400">模态分析 · 频率对比 · 参数追溯</span>
        <nav className="ml-auto flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                location.pathname === item.path
                  ? 'bg-[#D4A84B]/20 text-[#D4A84B]'
                  : 'text-stone-300 hover:bg-white/5 hover:text-stone-100'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
