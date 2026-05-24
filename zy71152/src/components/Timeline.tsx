import { useGameStore } from '../store/gameStore';

export default function Timeline() {
  const { time, level, sections } = useGameStore();

  if (!level) return null;

  const progress = Math.min(100, (time / level.timeLimit) * 100);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">时间轴</span>
        <span className="text-sm font-mono text-slate-300">
          {Math.floor(time)} / {level.timeLimit}
        </span>
      </div>
      
      <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        
        {sections.map((section) =>
          section.maintenance.map((window, idx) => (
            <div
              key={`${section.id}-${idx}`}
              className="absolute top-0 bottom-0 bg-red-500/30 border-x border-red-500"
              style={{
                left: `${(window.start / level.timeLimit) * 100}%`,
                width: `${((window.end - window.start) / level.timeLimit) * 100}%`
              }}
              title={`${section.name} 检修: ${window.start}-${window.end}`}
            />
          ))
        )}
        
        {level.trains.map(train => (
          <div
            key={train.id}
            className="absolute top-0 w-1 h-full"
            style={{
              left: `${(train.scheduledDeparture / level.timeLimit) * 100}%`,
              backgroundColor: train.color
            }}
            title={`${train.name} 发车`}
          />
        ))}
      </div>
      
      <div className="flex gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-slate-400">进度</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500/50 rounded" />
          <span className="text-slate-400">检修窗口</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1 h-3 bg-slate-400 rounded" />
          <span className="text-slate-400">发车点</span>
        </div>
      </div>
    </div>
  );
}
