import { useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useChecklistStore } from '@/store/checklistStore';

export function TimelineSlider() {
  const timelineDate = useUiStore((s) => s.timelineDate);
  const setTimelineDate = useUiStore((s) => s.setTimelineDate);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const materials = useChecklistStore((s) => s.materialSubmissions);

  const allDates = useMemo(() => {
    const s = new Set<string>();
    Object.values(visaForms).forEach((v) => s.add(v.issueDate));
    Object.values(materials).forEach((m) => s.add(m.submitDate));
    return Array.from(s).sort();
  }, [visaForms, materials]);

  if (allDates.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-[11px] text-slate-400 italic shadow-sm">
        暂无签证单或材料送审日期，时间轴暂不可用
      </div>
    );
  }

  const minIdx = 0;
  const maxIdx = allDates.length - 1;
  const currentIdx = timelineDate ? allDates.indexOf(timelineDate) : -1;
  const pct = currentIdx >= 0 ? (currentIdx / Math.max(maxIdx, 1)) * 100 : 100;

  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-bold">时间轴 · 签证签发 / 材料进场</span>
          <span className="text-[10px] text-slate-400">
            （共 {allDates.length} 个关键日期，滑动过滤构件）
          </span>
        </div>
        {timelineDate && (
          <button
            onClick={() => setTimelineDate(null)}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
          >
            <X className="h-3 w-3" /> 清除截止
          </button>
        )}
      </div>

      <div className="relative px-2">
        <div className="relative h-2 rounded-full bg-slate-100">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={minIdx}
            max={maxIdx}
            step={1}
            value={currentIdx >= 0 ? currentIdx : maxIdx}
            onChange={(e) => setTimelineDate(allDates[Number(e.target.value)])}
            className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-white shadow-md transition-all"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[10px] text-slate-500 font-mono">
          {allDates.map((d, i) => {
            const isCur = d === timelineDate;
            const showTick = i === 0 || i === maxIdx || isCur || i % Math.ceil(allDates.length / 5) === 0;
            if (!showTick) return <div key={d} className="w-0 overflow-hidden" />;
            return (
              <div key={d} className="flex flex-col items-center">
                <span className="h-2 w-px bg-slate-200" />
                <span
                  className={`mt-0.5 rounded px-1 ${
                    isCur ? 'bg-blue-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {fmt(d)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
