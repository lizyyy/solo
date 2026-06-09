import type { CausalStep } from '../types/review';
import { formatDate } from '../utils/statusMappings';
import { FileWarning, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  steps: CausalStep[];
}

export function CausalTimeline({ steps }: Props) {
  return (
    <div className="relative">
      {steps.map((step, idx) => {
        const isLate = !!step.isLateStep;
        return (
          <div
            key={step.id}
            className="timeline-step animate-fade-in-stagger"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div
              className={`timeline-dot ${
                isLate ? 'bg-status-late' : idx === steps.length - 1 ? 'bg-slate-900' : 'bg-status-confirmed'
              }`}
            >
              {isLate ? (
                <AlertTriangle size={10} className="text-white" />
              ) : idx === steps.length - 1 ? (
                <CheckCircle2 size={10} className="text-white" />
              ) : (
                <span className="block w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </div>
            <div
              className={`rounded-lg border p-4 ${
                isLate
                  ? 'border-status-late/30 bg-status-late-bg/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-xs font-semibold text-slate-700">
                  {formatDate(step.date)}
                </span>
                {isLate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-late/15 px-2 py-0.5 text-[10px] font-medium text-status-late">
                    <FileWarning size={10} />
                    晚到相关
                  </span>
                )}
              </div>
              <div className="mt-1.5 font-semibold text-slate-900">{step.title}</div>
              <div className="mt-1 text-sm text-slate-600 leading-relaxed">
                {step.description}
              </div>
              {step.impactNote && (
                <div className="mt-2 rounded-md bg-slate-900/5 p-2 text-xs text-slate-700 border-l-2 border-slate-900/40 pl-2">
                  <span className="font-semibold">影响：</span>
                  {step.impactNote}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
