import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Leaf,
} from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';

const PERIODS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4'];

const NAV_ITEMS = [
  { path: '/', label: '数据总览', icon: LayoutDashboard },
  { path: '/quota', label: '配额归集', icon: Layers },
  { path: '/hedging', label: '锁价匹配', icon: ShieldCheck },
  { path: '/budget', label: '预算预警', icon: AlertTriangle },
  { path: '/report', label: '报告导出', icon: FileText },
];

export default function Layout() {
  const period = useCarbonStore((s) => s.period);
  const setPeriod = useCarbonStore((s) => s.setPeriod);

  return (
    <div className="flex min-h-screen bg-sage-bg">
      <aside
        className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col"
        style={{ background: 'linear-gradient(180deg, #0D4B3C 0%, #0A3D31 100%)' }}
      >
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <Leaf className="h-6 w-6 text-amber-accent" />
          </div>
          <h1 className="font-serif text-lg text-white leading-tight">
            碳配额履约<br />资金表
          </h1>
        </div>

        <div className="px-4 pb-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-amber-accent"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p} className="text-forest-green">
                {p}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-3 border-amber-accent bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-xs text-white/40">碳配额履约资金管理系统</p>
        </div>
      </aside>

      <main className="ml-64 flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
