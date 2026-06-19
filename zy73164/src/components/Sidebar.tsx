import { NavLink } from 'react-router-dom';
import { LayoutGrid, Boxes, AlertOctagon, ClipboardList, RotateCcw, Activity } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/console', label: '回放控制台', icon: LayoutGrid, desc: '提交 · 幂等 · 除零边界' },
  { to: '/materials', label: '材料与历史', icon: Boxes, desc: '历史答案 · 改判 · 后补说明' },
  { to: '/anomalies', label: '异常看板', icon: AlertOctagon, desc: '空集合 · 除零 · 待复核' },
  { to: '/handoff', label: '值班交接', icon: ClipboardList, desc: '三区指引 · 追溯线索' },
];

export function Sidebar() {
  const runs = useReplayStore((s) => s.runs);
  const overrides = useReplayStore((s) => s.overrides);
  const reset = useReplayStore((s) => s.resetToSeed);
  const pending = runs.filter((r) => r.status === 'pending_review').length;
  const overrideCount = Object.keys(overrides).length;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 lg:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent/15 text-accent">
          <Activity className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink-100">矩阵分解参数回放</div>
          <div className="mono text-[10px] tracking-widest text-muted">MFPR · CONSOLE</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-start gap-3 rounded-sm px-3 py-2.5 transition-colors',
                isActive ? 'bg-accent/10 text-ink-100' : 'text-ink-300 hover:bg-white/[0.04]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn('mt-0.5 h-4 w-4 shrink-0', isActive ? 'text-accent' : 'text-muted')}
                />
                <div className="leading-tight">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-[11px] text-muted">{item.desc}</div>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="mono text-lg text-ink-100">{runs.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">回放</div>
          </div>
          <div>
            <div className="mono text-lg text-warn">{pending}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">待复核</div>
          </div>
          <div>
            <div className="mono text-lg text-accent">{overrideCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">改判</div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-white/10 px-2 py-2 text-[11px] text-muted transition-colors hover:bg-white/5 hover:text-ink-200"
        >
          <RotateCcw className="h-3 w-3" />
          重置为种子数据
        </button>
      </div>
    </aside>
  );
}
