import { useAppStore } from '@/store/useAppStore';
import { useMemo } from 'react';

const INSPECTION_DATES = [
  '2024-12-01',
  '2024-12-02',
  '2024-12-03',
  '2024-12-04',
  '2024-12-05',
];

export function Timeline() {
  const points = useAppStore(s => s.points);
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);

  const dateStats = useMemo(() => {
    return INSPECTION_DATES.map(date => {
      const datePoints = points.filter(p => p.inspectionDate === date);
      const anomalies = datePoints.filter(p => p.status !== 'normal' && p.status !== 'warning');
      return { date, total: datePoints.length, anomalies: anomalies.length };
    });
  }, [points]);

  const minIdx = 0;
  const maxIdx = INSPECTION_DATES.length - 1;
  const currentIdx = INSPECTION_DATES.indexOf(currentDate);

  return (
    <div className="h-full flex items-center gap-4 px-4">
      <div className="text-xs text-slate-400 shrink-0 w-16">
        {currentDate}
      </div>

      <div className="flex-1 relative h-8 flex items-center">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-slate-700/50 -translate-y-1/2 rounded-full" />

        {dateStats.map((stat, idx) => {
          const isActive = idx === currentIdx;
          const hasAnomaly = stat.anomalies > 0;

          return (
            <button
              key={stat.date}
              onClick={() => setCurrentDate(stat.date)}
              className="relative z-10 flex flex-col items-center"
              style={{ left: `${(idx / maxIdx) * 100}%`, position: 'absolute', transform: 'translateX(-50%)' }}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? hasAnomaly
                      ? 'bg-red-500 border-red-400 scale-150 shadow-lg shadow-red-500/50'
                      : 'bg-amber-500 border-amber-400 scale-150 shadow-lg shadow-amber-500/50'
                    : hasAnomaly
                      ? 'bg-red-500/50 border-red-500/70'
                      : 'bg-slate-600 border-slate-500'
                }`}
              />
              <div className={`text-xs mt-1 whitespace-nowrap ${
                isActive ? 'text-slate-200' : 'text-slate-600'
              }`}>
                {stat.date.slice(5)}
              </div>
              {hasAnomaly && (
                <div className="absolute -top-4 text-xs text-red-400 font-mono">
                  {stat.anomalies}
                </div>
              )}
            </button>
          );
        })}

        <input
          type="range"
          min={minIdx}
          max={maxIdx}
          value={currentIdx >= 0 ? currentIdx : 0}
          onChange={e => setCurrentDate(INSPECTION_DATES[parseInt(e.target.value)])}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
        />
      </div>

      <div className="text-xs text-slate-500 shrink-0">
        {points.filter(p => p.inspectionDate === currentDate).length} 个点位
      </div>
    </div>
  );
}
