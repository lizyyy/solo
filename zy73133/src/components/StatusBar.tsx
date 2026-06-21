import { Activity, AlertTriangle, CheckCircle2, Waves } from 'lucide-react';
import { useTidalStore, getCounts } from '@/store/useTidalStore';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const batch = useTidalStore((s) => s.batch);
  const consistency = useTidalStore((s) => s.consistency);
  const counts = getCounts(batch);

  return (
    <header className="flex h-14 items-center justify-between border-b border-glow-teal/20 bg-abyss-800/80 px-5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-glow-deep/30 shadow-glow">
          <Waves className="h-5 w-5 text-glow-cyan" />
          <span className="absolute inset-0 rounded-lg ring-1 ring-glow-cyan/40" />
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-[15px] font-bold tracking-wide text-signal-moon">
            潮汐能站空间标注控制台
          </h1>
          <p className="font-mono text-[10px] text-glow-teal/70">
            TIDAL ANNOTATION DECK · 水质分析师阿乔工作台
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {batch && (
          <span className="hidden font-mono text-[10px] text-signal-moon/50 sm:inline">
            批次 <span className="text-glow-cyan">{batch.batchId}</span> · 版本 v{batch.currentVersion}
          </span>
        )}
        <CountPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="正常" value={counts.ok} color="cyan" />
        <CountPill icon={<AlertTriangle className="h-3.5 w-3.5" />} label="待核查" value={counts.exception + counts.pending} color="amber" />
        <ConsistencyIndicator ok={consistency?.consistent ?? false} />
      </div>
    </header>
  );
}

function CountPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'cyan' | 'amber' | 'coral' }) {
  const styles = {
    cyan: 'border-glow-cyan/40 text-glow-cyan bg-glow-cyan/10',
    amber: 'border-signal-amber/40 text-signal-amber bg-signal-amber/10',
    coral: 'border-signal-coral/40 text-signal-coral bg-signal-coral/10',
  }[color];
  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]', styles)}>
      {icon}
      <span className="text-signal-moon/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ConsistencyIndicator({ ok }: { ok: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]',
        ok
          ? 'border-glow-cyan/50 bg-glow-cyan/10 text-glow-cyan'
          : 'border-signal-coral/50 bg-signal-coral/10 text-signal-coral',
      )}
    >
      <Activity className="h-3.5 w-3.5" />
      <span>{ok ? '界面与导出一致' : '一致性待校验'}</span>
    </div>
  );
}
