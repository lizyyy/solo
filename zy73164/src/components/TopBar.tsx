import { NavLink } from 'react-router-dom';
import { LayoutGrid, Boxes, AlertOctagon, ClipboardList, Radio } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { StatusDot, statusMeta } from './primitives';
import { FingerprintTag } from './FingerprintTag';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/console', label: '控制台', icon: LayoutGrid },
  { to: '/materials', label: '材料', icon: Boxes },
  { to: '/anomalies', label: '异常', icon: AlertOctagon },
  { to: '/handoff', label: '交接', icon: ClipboardList },
];

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const runs = useReplayStore((s) => s.runs);
  const results = useReplayStore((s) => s.results);
  const lastRunId = useReplayStore((s) => s.lastRunId);
  const lastHit = useReplayStore((s) => s.lastHit);
  const lastRun = runs.find((r) => r.runId === lastRunId);
  const lastResult = lastRunId ? results[lastRunId] : undefined;
  const meta = lastRun ? statusMeta(lastRun.status) : undefined;

  return (
    <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-ink-100 sm:text-lg">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {lastRun && meta && (
            <div className="hidden items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-2.5 py-1.5 sm:flex">
              <Radio className={cn('h-3.5 w-3.5', lastHit ? 'text-accent' : 'text-ok')} />
              <span className="text-[11px] text-muted">最新</span>
              <StatusDot tone={meta.tone} />
              <span className="text-[11px] text-ink-200">{meta.label}</span>
              <FingerprintTag fp={lastRun.fingerprint} />
            </div>
          )}
          {lastResult && (
            <div className="hidden items-center gap-1.5 md:flex">
              <span className="text-[11px] text-muted">幂等</span>
              <span
                className={cn(
                  'mono rounded-sm px-1.5 py-0.5 text-[11px]',
                  lastHit ? 'bg-accent/15 text-accent' : 'bg-ok/10 text-ok',
                )}
              >
                {lastHit ? '命中' : '新建'}
              </span>
            </div>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-semibold',
                isActive ? 'bg-accent/10 text-accent' : 'text-ink-300 hover:bg-white/5',
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
