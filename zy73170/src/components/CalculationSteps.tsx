import { Route } from 'lucide-react';
import { useState } from 'react';
import { useSampleStore } from '../store/useSampleStore';
import type { CalculationStep } from '../types';

interface Props {
  steps: CalculationStep[];
}

export default function CalculationSteps({ steps }: Props) {
  const setHl = useSampleStore((s) => s.setHighlightedDraftLine);
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-display text-lg text-ink-900 flex items-center gap-2">
          <Route className="w-4 h-4 text-ink-600" />
          验算过程 · 数字线索追溯
        </h3>
        <span className="label">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <ol className="relative border-l-2 border-ink-200 ml-3 space-y-4 py-1">
          {steps.map((st) => (
            <li
              key={st.id}
              className="relative pl-5 group"
              onMouseEnter={() => setHl(st.sourceRef.startsWith('s') ? st.sourceRef : null)}
              onMouseLeave={() => setHl(null)}
            >
              <span
                className="absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center shadow-card"
                style={{ backgroundColor: st.clueColor || '#1e3a5f' }}
                aria-hidden
              />
              <div className="rounded-lg border border-ink-200 bg-white p-3 hover:border-ink-300 hover:shadow-card transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-mono text-ink-500">Step {st.stepNumber}</div>
                    <div className="mt-0.5 text-sm text-ink-900 font-medium">
                      {st.description}
                    </div>
                    <div
                      className="mt-1 font-display text-lg leading-tight"
                      style={{ color: st.clueColor || '#1e3a5f' }}
                    >
                      {st.value}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-white text-ink-600 border-ink-200 group-hover:bg-amber2-50 group-hover:border-amber2-200 group-hover:text-amber2-700 transition-colors"
                      title="hover 时对应草稿行高亮"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: st.clueColor || '#1e3a5f' }}
                      />
                      {st.sourceClue}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
