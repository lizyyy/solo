import { useAppStore } from '../../store/useStore';
import {
  RefreshCw,
  Upload,
  Droplets,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const SCHEME_TABS: { id: 'A' | 'B' | 'C'; name: string }[] = [
  { id: 'A', name: '檐沟外排水' },
  { id: 'B', name: '天沟内排水' },
  { id: 'C', name: '混合排水' },
];

export default function TopBar() {
  const selected = useAppStore((s) => s.selectedSchemeId);
  const notesImported = useAppStore((s) => s.notesImported);
  const rerunHistoryLen = useAppStore((s) => s.rerunHistory.length);
  const allAnomalies = useAppStore((s) => s.anomalies);
  const rerunCount = rerunHistoryLen;
  const anomalyCount = allAnomalies.filter((a) => a.status !== 'resolved').length;

  return (
    <div className="relative border-b border-slate-700/60 bg-slate-950/80 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.55) 30%, rgba(245,158,11,0.55) 70%, transparent 100%)',
        }}
      />
      <div className="flex h-14 items-center gap-4 px-5">
        <div
          className="flex items-center gap-2.5"
          style={{ fontFamily: '"Chakra Petch", "Noto Sans SC", sans-serif' }}
        >
          <div className="relative">
            <Droplets size={18} className="text-blue-400" strokeWidth={2.2} />
            <span className="absolute -inset-1 rounded-full bg-blue-500/20 blur-md" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[0.22em] text-slate-100">
              屋面排水方案比选
            </div>
            <div className="font-mono text-[10px] tracking-wider text-slate-500">
              ROOF DRAINAGE · COMPARISON CONSOLE · v1.0
            </div>
          </div>
        </div>

        <div className="mx-4 h-7 w-px bg-slate-700/60" />

        <div className="flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/60 p-1">
          {SCHEME_TABS.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => useAppStore.getState().selectScheme(t.id)}
                className={twMerge(
                  'group relative flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] transition-all',
                  active
                    ? 'bg-gradient-to-br from-blue-600/90 to-blue-700/70 text-white shadow-[0_0_16px_-4px_rgba(59,130,246,0.8)]'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200',
                )}
              >
                <Layers size={13} />
                <span
                  className="font-mono"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {t.id}
                </span>
                <span className="hidden md:inline">{t.name}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className={twMerge(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]',
              anomalyCount > 0
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
            )}
          >
            <AlertTriangle size={12} />
            <span
              className="font-mono"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {anomalyCount} ACTIVE
            </span>
            <span className="hidden md:inline text-slate-400">异常</span>
          </div>

          {rerunCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '6s' }} />
              <span
                className="font-mono"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                RERUN x{rerunCount}
              </span>
            </div>
          )}

          <button
            onClick={useAppStore.getState().importSampleNotes}
            disabled={notesImported}
            className={twMerge(
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-all',
              notesImported
                ? 'cursor-not-allowed border-emerald-600/40 bg-emerald-500/10 text-emerald-400'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-100',
            )}
          >
            <Upload size={13} />
            <span>{notesImported ? 'BIM 备注已导入 ✓' : '导入 BIM 备注样例'}</span>
          </button>

          <button
            onClick={useAppStore.getState().rerunComparison}
            className="flex items-center gap-1.5 rounded-md border border-amber-500/60 bg-gradient-to-br from-amber-500/25 to-orange-600/20 px-3 py-1.5 text-[12px] text-amber-100 hover:from-amber-500/40 hover:to-orange-600/35 transition-all shadow-[0_0_16px_-5px_rgba(245,158,11,0.6)]"
          >
            <RefreshCw size={13} />
            <span>重跑比选</span>
          </button>
        </div>
      </div>
    </div>
  );
}
