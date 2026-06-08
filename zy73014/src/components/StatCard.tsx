import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}

function useCountUp(target: number, duration = 600) {
  const [v, setV] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(p * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);
  return v;
}

export default function StatCard({ icon: Icon, label, value, color, active, onClick }: Props) {
  const display = useCountUp(value);
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left rounded-card border bg-white p-5 card-shadow card-hover btn-press transition-all group',
        active ? 'ring-2 border-transparent' : 'border-slate-200',
      ].join(' ')}
      style={active ? { boxShadow: `0 0 0 2px ${color}33, 0 8px 24px rgba(38,70,83,.08)` } : undefined}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-[10px] text-brand-ink/40 font-kai">点击筛选</span>
      </div>
      <div className="mt-4">
        <div className="text-[12px] font-kai text-brand-ink/60 mb-1">{label}</div>
        <div
          className="font-serif text-[36px] leading-none font-bold animate-countUp"
          style={{ color }}
        >
          {display}
        </div>
      </div>
    </button>
  );
}
