import { Link, NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Flame,
  ClipboardList,
  Upload,
  CalendarCheck2,
  User,
  Settings2,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: '交底清单', icon: ClipboardList, end: true },
  { to: '/import', label: '材料导入', icon: Upload },
  { to: '/review', label: '月底复核', icon: CalendarCheck2 },
];

export function AppHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 shadow-md shadow-orange-200/60 transition-transform group-hover:scale-105">
            <Flame className="h-5 w-5 text-white" strokeWidth={2.5} fill="currentColor" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-slate-900">
              消防分区交底清单
            </span>
            <span className="text-[10.5px] font-medium tracking-wider text-slate-400 uppercase">
              Fire Zone Disclosure
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="设置"
          >
            <Settings2 className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 transition hover:border-orange-200 hover:bg-orange-50/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm">
              <User className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-[12px] font-semibold text-slate-800">阿乔</span>
              <span className="text-[10px] text-slate-500">施工经理</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-0.5 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'inline-flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
                isActive
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
