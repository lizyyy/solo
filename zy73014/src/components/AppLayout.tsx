import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardCheck, Handshake, UserCircle, PawPrint } from 'lucide-react';
import { useMemo } from 'react';

const TABS = [
  { to: '/', label: '复核看板', icon: ClipboardCheck, role: '复核人' },
  { to: '/handover', label: '交接视图', icon: Handshake, role: '算法值班人' },
  { to: '/reception', label: '接班卡片', icon: UserCircle, role: '前台小温' },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const activeRole = useMemo(
    () => TABS.find((t) => t.to === pathname)?.role ?? '复核人',
    [pathname],
  );
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 backdrop-blur border-b border-slate-200/70 bg-white/70">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-teal to-brand-orange flex items-center justify-center text-white shadow-sm">
              <PawPrint className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <h1 className="font-serif text-lg font-bold text-brand-ink">宠物寄养回访追踪</h1>
              <p className="text-[11px] text-brand-ink/60 font-kai">让新旧信息对得上 · 让交接不漏项 · 让历史可追溯</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 card-shadow">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-kai btn-press transition-all',
                      isActive
                        ? 'bg-brand-ink text-white shadow-inner'
                        : 'text-brand-ink/70 hover:text-brand-ink hover:bg-slate-50',
                    ].join(' ')
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-sm font-kai text-brand-ink/70">
            <span className="hidden md:inline">当前视角：</span>
            <span className="px-2.5 py-1 rounded-full bg-brand-orange/15 text-brand-ink border border-brand-orange/40">
              {activeRole}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-6">
        <Outlet />
      </main>

      <footer className="text-center text-[11px] text-brand-ink/40 py-4 font-kai">
        © 2026 宠物医院寄养回访看板 · 样例演示版本（含边界样本与现场毛边）
      </footer>
    </div>
  );
}
