import { useMemo } from 'react';
import { useAppStore } from '../../store';
import { calculateStatistics, formatTime } from '../../utils/statistics';

export const StatusBar = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);

  const stats = useMemo(() => {
    if (!data) return null;
    const snapshot = data.snapshots[currentTimeIndex];
    return calculateStatistics(data, snapshot.thicknessSamples, snapshot.timestamp);
  }, [data, currentTimeIndex]);

  if (!data || !stats) {
    return (
      <div className="h-10 bg-slate-900/80 border-b border-slate-700 flex items-center justify-center">
        <p className="text-sm text-slate-400">请导入数据开始使用</p>
      </div>
    );
  }

  const totalSamples = stats.normalCount + stats.warningCount + stats.criticalCount + stats.missingCount;
  const completionRate = ((stats.normalCount + stats.warningCount + stats.criticalCount) / totalSamples * 100).toFixed(1);

  return (
    <div className="h-10 bg-slate-900/80 border-b border-slate-700 flex items-center px-4 gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">时间:</span>
        <span className="text-cyan-400 font-mono">
          {formatTime(data.snapshots[currentTimeIndex].timestamp)}
        </span>
      </div>

      <div className="h-6 w-px bg-slate-700" />

      <div className="flex items-center gap-2">
        <span className="text-slate-400">平均厚度:</span>
        <span className="text-white font-mono">{stats.avgThickness.toFixed(1)} mm</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">最小:</span>
        <span className={`font-mono ${stats.minThickness < data.rink.thicknessThreshold ? 'text-red-400' : 'text-white'}`}>
          {stats.minThickness.toFixed(1)} mm
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">最大:</span>
        <span className="text-white font-mono">{stats.maxThickness.toFixed(1)} mm</span>
      </div>

      <div className="h-6 w-px bg-slate-700" />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-green-400 font-mono">{stats.normalCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span className="text-yellow-400 font-mono">{stats.warningCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-red-400 font-mono">{stats.criticalCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="text-gray-400 font-mono">{stats.missingCount}</span>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-700" />

      <div className="flex items-center gap-2">
        <span className="text-slate-400">采样完成率:</span>
        <span className={`font-mono ${Number(completionRate) < 90 ? 'text-yellow-400' : 'text-green-400'}`}>
          {completionRate}%
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400">平均温度:</span>
        <span className={`font-mono ${stats.avgTemperature > data.rink.temperatureWarning ? 'text-orange-400' : 'text-cyan-400'}`}>
          {stats.avgTemperature.toFixed(1)}°C
        </span>
      </div>

      {stats.pendingRepairs > 0 && (
        <>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-2 bg-amber-500/20 px-3 py-1 rounded-full">
            <span className="text-amber-400">⚠️ 待复测修补: {stats.pendingRepairs}</span>
          </div>
        </>
      )}
    </div>
  );
};
