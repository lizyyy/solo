import {
  LayoutGrid,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Tags,
  Timer,
} from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';

interface StatPillProps {
  icon: typeof LayoutGrid;
  label: string;
  value: string | number;
  valueClass?: string;
  dot?: string;
}

function StatPill({ icon, label, value, valueClass = '', dot }: StatPillProps) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-ocean-surface/60
      border border-ocean-line rounded-full clip-bevel-sm">
      {dot && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: dot }}
        />
      )}
      <Icon size={13} className="text-console-dim shrink-0" />
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[10px] font-mono text-console-muted uppercase tracking-wider shrink-0">
          {label}
        </span>
        <span
          className={`font-mono text-[13px] font-semibold ${valueClass || 'text-console-text'}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso.slice(11, 19) || '—';
  }
}

export default function StatusBar() {
  const { stats, current_version, processed_at } = useTidalStore();

  return (
    <footer className="h-[32px] flex items-center gap-2 px-3
      bg-ocean-surface/95 border-t border-ocean-line backdrop-blur-sm
      overflow-x-auto console-scroll">
      <div className="grid grid-cols-6 gap-2 w-full min-w-[720px]">
        <StatPill
          icon={LayoutGrid}
          label="总数"
          value={stats.total}
          valueClass="text-console-text"
        />
        <StatPill
          icon={CheckCircle2}
          label="正常"
          value={`${stats.normal}`}
          dot="#38d39f"
          valueClass="text-buoy-green"
        />
        <StatPill
          icon={Clock}
          label="待核查"
          value={`${stats.pending}`}
          dot="#ffc93c"
          valueClass="text-buoy-yellow"
        />
        <StatPill
          icon={AlertOctagon}
          label="异常"
          value={`${stats.exception}`}
          dot="#ff5e62"
          valueClass="text-buoy-red"
        />
        <StatPill
          icon={Tags}
          label="版本"
          value={`v${current_version}`}
          valueClass="text-glow-cyan"
        />
        <StatPill
          icon={Timer}
          label="处理时间"
          value={formatTime(processed_at)}
          valueClass="text-console-muted"
        />
      </div>
    </footer>
  );
}
