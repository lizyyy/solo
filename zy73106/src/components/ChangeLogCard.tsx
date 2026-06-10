import { ArrowRight } from 'lucide-react';
import type { ValueChangeLog } from '@/types';
import { formatDateTime } from '@/utils/date';

interface ChangeLogCardProps {
  log: ValueChangeLog;
}

export default function ChangeLogCard({ log }: ChangeLogCardProps) {
  const diff = log.newValue - log.oldValue;
  const isIncrease = diff > 0;
  const isZero = diff === 0;

  return (
    <div className="panel-bordered p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-steel-500 via-[#3498DB] to-steel-500 opacity-50" />

      <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-steel-600">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3498DB]" />
          <span className="font-mono text-xs uppercase tracking-wider text-steel-300">
            {log.fieldLabel}
          </span>
          <span className="font-mono text-[10px] uppercase text-steel-500 tracking-widest">
            · {log.fieldName}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-steel-500">
          CHANGE · {log.id.slice(0, 6).toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex-1 lg:flex-none lg:min-w-[140px]">
          <div className="font-mono text-[10px] uppercase tracking-wider text-steel-500 mb-1">
            原值 OLD
          </div>
          <div className="font-mono text-xl md:text-2xl text-steel-400 line-through">
            {log.oldValue}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-3 lg:gap-4">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-steel-500
                            flex items-center justify-center bg-steel-800">
              <ArrowRight className="w-4 h-4 text-[#5DADE2]" />
            </div>
            <div className="hidden lg:block absolute -right-2 w-4 h-4 border-t-2 border-r-2 border-dashed border-steel-600 rotate-45" />
          </div>

          <div className="flex-1 lg:min-w-[200px]">
            <div className="relative px-3 py-2 bg-steel-700/50 border border-steel-600">
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2
                              w-2 h-2 rotate-45 bg-steel-700 border-l border-b border-steel-600 hidden lg:block" />
              <div className="font-mono text-xs text-steel-100 leading-relaxed">
                {log.reason}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-dashed border-steel-600
                              flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#5DADE2]">
                  {log.operatorName}
                </span>
                <span className="font-mono text-[10px] text-steel-500">
                  {formatDateTime(log.changedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 lg:flex-none lg:min-w-[160px]">
          <div className="font-mono text-[10px] uppercase tracking-wider text-steel-500 mb-1">
            新值 NEW
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-display text-2xl md:text-3xl text-[#5DADE2]">
              {log.newValue}
            </div>
            {!isZero && (
              <div className={`
                font-mono text-xs uppercase tracking-wider px-1.5 py-0.5 border
                ${isIncrease
                  ? 'border-[#C0392B] text-[#E74C3C] bg-[#C0392B]/10'
                  : 'border-blueprint-green text-blueprint-green bg-blueprint-green/10'
                }
              `}>
                {isIncrease ? '+' : ''}{diff}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
