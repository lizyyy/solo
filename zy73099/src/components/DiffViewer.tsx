import type { DiffResult } from '@/types';
import { cn } from '@/lib/utils';
import { ArrowRight, Plus, Minus } from 'lucide-react';

interface DiffViewerProps {
  diff: DiffResult;
  beforeLabel?: string;
  afterLabel?: string;
}

export function DiffViewer({
  diff,
  beforeLabel = '确认前',
  afterLabel = '确认后',
}: DiffViewerProps) {
  const renderInline = () => (
    <p className="text-[14px] leading-7 break-words">
      {diff.segments.map((seg, idx) => {
        if (seg.type === 'equal') {
          return (
            <span key={idx} className="text-slate-700">
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'added') {
          return (
            <span
              key={idx}
              className="bg-emerald-100 text-emerald-800 rounded px-0.5 py-0.5 relative"
            >
              <Plus className="inline h-3 w-3 -mt-0.5 mr-0.5 text-emerald-600" strokeWidth={3} />
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={idx}
            className="bg-rose-100 text-rose-800 rounded px-0.5 py-0.5 line-through decoration-rose-400"
          >
            <Minus className="inline h-3 w-3 -mt-0.5 mr-0.5 text-rose-600" strokeWidth={3} />
            {seg.text}
          </span>
        );
      })}
    </p>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 border border-emerald-400" />
            <span className="text-emerald-700 font-medium">新增 {diff.addedCount} 字</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-200 border border-rose-400" />
            <span className="text-rose-700 font-medium">删除 {diff.removedCount} 字</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{beforeLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span>{afterLabel}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>差异内联视图</span>
        </div>
        {renderInline()}
      </div>
    </div>
  );
}
