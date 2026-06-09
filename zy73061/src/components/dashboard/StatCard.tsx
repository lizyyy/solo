import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WarningLevel } from '@/types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: number;
  level?: WarningLevel | 'pending';
  unit?: string;
  delta?: { value: number; label: string };
  clickTo?: string;
  accentStyle: 'red' | 'orange' | 'green' | 'blue' | 'yellow';
  icon: React.ReactNode;
}

const accentMap: Record<StatCardProps['accentStyle'], { bar: string; text: string; ring: string; bg: string }> = {
  red: { bar: 'bg-alert-red', text: 'text-alert-red', ring: 'ring-alert-red/20', bg: 'bg-alert-red/5' },
  orange: { bar: 'bg-alert-orange', text: 'text-alert-orange', ring: 'ring-alert-orange/20', bg: 'bg-alert-orange/5' },
  green: { bar: 'bg-alert-green', text: 'text-alert-green', ring: 'ring-alert-green/20', bg: 'bg-alert-green/5' },
  blue: { bar: 'bg-alert-blue', text: 'text-alert-blue', ring: 'ring-alert-blue/20', bg: 'bg-alert-blue/5' },
  yellow: { bar: 'bg-alert-yellow', text: 'text-[#b08900]', ring: 'ring-alert-yellow/30', bg: 'bg-alert-yellow/10' },
};

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(target * eased);
      if (current !== start) {
        start = current;
        setValue(current);
      }
      if (t < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export default function StatCard({ title, value, unit, delta, clickTo, accentStyle, icon }: StatCardProps) {
  const navigate = useNavigate();
  const display = useCountUp(value);
  const accent = accentMap[accentStyle];
  const clickable = Boolean(clickTo);

  const content = (
    <div
      className={`card-base relative overflow-hidden transition-all duration-300 ${
        clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-hover hover:ring-2 ' + accent.ring : ''
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent.bar}`} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-industrial-500 font-medium mb-1.5">{title}</div>
            <div className="flex items-baseline gap-1.5">
              <span className={`num text-3xl font-bold ${accent.text}`}>{display}</span>
              {unit && <span className="text-sm text-industrial-400">{unit}</span>}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-lg ${accent.bg} flex items-center justify-center shrink-0 ${accent.text}`}>
            {icon}
          </div>
        </div>
        {delta && (
          <div className="mt-4 pt-3 border-t border-surface-border flex items-center gap-2 text-xs">
            {delta.value > 0 ? (
              <ArrowUpRight className={`w-3.5 h-3.5 ${accent.text}`} />
            ) : delta.value < 0 ? (
              <ArrowDownRight className="w-3.5 h-3.5 text-alert-green" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-industrial-400" />
            )}
            <span
              className={
                delta.value > 0
                  ? `font-medium ${accent.text}`
                  : delta.value < 0
                    ? 'font-medium text-alert-green'
                    : 'text-industrial-400'
              }
            >
              {delta.value > 0 ? '+' : ''}
              {delta.value}
            </span>
            <span className="text-industrial-500">{delta.label}</span>
          </div>
        )}
      </div>
    </div>
  );

  return clickable ? (
    <div onClick={() => navigate(clickTo!)} role="button" tabIndex={0}>
      {content}
    </div>
  ) : (
    content
  );
}
