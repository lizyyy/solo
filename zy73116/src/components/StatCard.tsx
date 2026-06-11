import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  icon?: ReactNode;
  accent: string;
  sub?: string;
}

export default function StatCard({ label, value, icon, accent, sub }: Props) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-ink-700/60 bg-ink-850/60 backdrop-blur px-4 py-3 transition hover:border-ink-600">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.07] blur-2xl" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
          <div className="mt-1 text-3xl font-mono-num font-semibold" style={{ color: accent }}>
            {value}
          </div>
          {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
        </div>
        {icon && <div className="text-ink-500" style={{ color: accent, opacity: 0.7 }}>{icon}</div>}
      </div>
    </div>
  );
}
