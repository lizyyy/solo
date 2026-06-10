import { useMemo } from 'react';
import { useTrackStore } from '@/stores/trackStore';
import type { TrackRun } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Timeline() {
  const currentBatchId = useTrackStore((s) => s.currentBatchId);
  const currentRunId = useTrackStore((s) => s.currentRunId);
  const setCurrentRun = useTrackStore((s) => s.setCurrentRun);
  const getRunsByBatchId = useTrackStore((s) => s.getRunsByBatchId);

  const runs: TrackRun[] = useMemo(
    () => (currentBatchId ? getRunsByBatchId(currentBatchId) : []),
    [currentBatchId, getRunsByBatchId]
  );

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-400">
        当前批次暂无执行记录
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    failed: 'bg-red-500',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>图纸版本时间轴 · 共 {runs.length} 个节点</span>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            disabled={!currentRunId || runs.findIndex((r) => r.runId === currentRunId) === 0}
            onClick={() => {
              const idx = runs.findIndex((r) => r.runId === currentRunId);
              if (idx > 0) setCurrentRun(runs[idx - 1].runId);
            }}
          >
            <ChevronLeft size={14} /> 上一版
          </button>
          <button
            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
            disabled={
              !currentRunId ||
              runs.findIndex((r) => r.runId === currentRunId) === runs.length - 1
            }
            onClick={() => {
              const idx = runs.findIndex((r) => r.runId === currentRunId);
              if (idx < runs.length - 1) setCurrentRun(runs[idx + 1].runId);
            }}
          >
            下一版 <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-2 right-2 top-4 h-0.5 bg-slate-200" />
        <div className="relative flex items-start justify-between gap-2">
          {runs.map((r) => {
            const isActive = r.runId === currentRunId;
            return (
              <button
                key={r.runId}
                onClick={() => setCurrentRun(r.runId)}
                className="group relative flex flex-1 flex-col items-center gap-2"
              >
                <span
                  className={cn(
                    'relative z-10 h-4 w-4 rounded-full border-2 border-white shadow transition-all',
                    statusColor[r.resultStatus],
                    isActive ? 'ring-4 ring-[#1F3A5F]/20 scale-125' : 'opacity-80 group-hover:opacity-100'
                  )}
                />
                <div
                  className={cn(
                    'text-center text-[11px] transition-colors',
                    isActive ? 'text-[#1F3A5F] font-semibold' : 'text-slate-500'
                  )}
                >
                  <div>{r.drawingVersion}</div>
                  <div className="text-slate-400">
                    {new Date(r.executedAt).toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
