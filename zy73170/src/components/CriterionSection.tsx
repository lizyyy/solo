import { FileCheck2 } from 'lucide-react';
import { CRITERIA } from '../data/mockData';

export default function CriterionSection() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink-900 flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-ink-600" />
          本次计算口径
        </h3>
        <span className="label">版本 {CRITERIA[0]?.version}</span>
      </div>
      <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4 space-y-3">
        {CRITERIA.map((c) => (
          <div
            key={c.id}
            className={`rounded-md p-3 border ${
              c.isEmptySetRule
                ? 'bg-ink-900 text-ink-50 border-ink-800 shadow-inset'
                : 'bg-white border-ink-200'
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`font-mono text-xs ${
                  c.isEmptySetRule ? 'text-amber2-200' : 'text-ink-500'
                }`}
              >
                {c.ruleNumber}
              </span>
              <span
                className={`font-semibold ${
                  c.isEmptySetRule ? 'text-white' : 'text-ink-900'
                }`}
              >
                {c.title}
              </span>
              {c.isEmptySetRule && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber2-500 text-ink-950 font-semibold">
                  空集合说明
                </span>
              )}
            </div>
            <p
              className={`mt-1 text-sm leading-relaxed ${
                c.isEmptySetRule ? 'text-ink-100' : 'text-ink-700'
              }`}
            >
              {c.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
