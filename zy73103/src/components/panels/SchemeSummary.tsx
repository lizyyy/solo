import { useAppStore } from '../../store/useStore';
import HudCard from '../common/HudCard';
import {
  Gauge,
  DollarSign,
  CalendarDays,
  ShieldAlert,
  AlertCircle,
  Award,
} from 'lucide-react';
import { schemeStatusLabel, getSchemeStroke } from '../../utils/helpers';
import { twMerge } from 'tailwind-merge';

export default function SchemeSummary() {
  const schemes = useAppStore((s) => s.schemes);
  const selected = useAppStore((s) => s.selectedSchemeId);
  const anomalies = useAppStore((s) => s.anomalies);
  const notes = useAppStore((s) => s.notes);

  const metrics = [
    { key: 'efficiency', label: '排水效率', suffix: '%', max: 100, Icon: Gauge, invert: false },
    { key: 'cost', label: '造价', suffix: '万', max: 250, Icon: DollarSign, invert: true },
    { key: 'duration', label: '工期', suffix: '天', max: 40, Icon: CalendarDays, invert: true },
    { key: 'risk', label: '风险', suffix: '/10', max: 10, Icon: ShieldAlert, invert: true },
  ] as const;

  return (
    <HudCard
      title="方案汇总 · 指标对比"
      accent="blue"
      icon={<Gauge size={12} className="text-blue-400" />}
      className="min-h-[170px]"
    >
      <div className="grid grid-cols-3 gap-2 p-3">
        {schemes.map((sc) => {
          const isSel = sc.id === selected;
          const anomCount = anomalies.filter(
            (a) => a.schemeId === sc.id && a.status !== 'resolved',
          ).length;
          const noteCount = notes.filter((n) => n.schemeId === sc.id).length;
          const stroke = getSchemeStroke(sc.id);
          return (
            <div
              key={sc.id}
              role="button"
              tabIndex={0}
              onClick={() => useAppStore.getState().selectScheme(sc.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  useAppStore.getState().selectScheme(sc.id);
                }
              }}
              className={twMerge(
                'group relative rounded-md border p-2.5 text-left transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400/60',
                isSel
                  ? 'border-blue-400/70 bg-slate-800/80 shadow-[0_0_22px_-8px_rgba(59,130,246,0.8)]'
                  : 'border-slate-700/60 bg-slate-800/30 hover:border-slate-500/60 hover:bg-slate-800/50',
              )}
              style={isSel ? { boxShadow: `0 0 22px -8px ${stroke}aa` } : undefined}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <div
                    className="flex items-center gap-1 font-mono text-[13px] font-semibold"
                    style={{ color: stroke, fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    方案 {sc.id}
                    <span
                      className={twMerge(
                        'ml-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        sc.recommLevel === '推荐'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : sc.recommLevel === '备选'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
                      )}
                    >
                      <Award size={9} className="inline mr-0.5 -mt-0.5" />
                      {sc.recommLevel}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-300">{sc.name}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    状态：<span className="text-slate-300">{schemeStatusLabel(sc.status)}</span>
                    {' · '}备注 {noteCount}
                  </div>
                </div>
                {anomCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useAppStore.getState().selectScheme(sc.id);
                      useAppStore.getState().setActivePanelTab('anomaly');
                      const first = anomalies.find(
                        (a) => a.schemeId === sc.id && a.status !== 'resolved',
                      );
                      if (first) useAppStore.getState().selectAnomaly(first.id);
                    }}
                    className="relative flex h-6 min-w-[24px] items-center justify-center rounded-full border border-red-500/60 bg-red-500/90 px-1.5 font-mono text-[11px] font-bold text-white shadow-[0_0_12px_-3px_rgba(239,68,68,0.7)] hover:bg-red-400 transition-colors"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    title="点击查看异常详情"
                  >
                    {anomCount}
                    <AlertCircle size={9} className="ml-0.5 opacity-90" />
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {metrics.map((m) => {
                  const v = sc[m.key as keyof typeof sc] as number;
                  const pct = Math.min(100, (v / m.max) * 100);
                  const score = m.invert ? 100 - pct : pct;
                  const color =
                    score > 70
                      ? 'bg-emerald-400/90'
                      : score > 45
                        ? 'bg-blue-400/90'
                        : 'bg-amber-400/90';
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <m.Icon size={9.5} className="text-slate-500" />
                          {m.label}
                        </span>
                        <span className="font-mono text-slate-200">
                          {v}
                          {m.suffix}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-700/60">
                        <div
                          className={twMerge('h-full rounded-full transition-all', color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </HudCard>
  );
}
