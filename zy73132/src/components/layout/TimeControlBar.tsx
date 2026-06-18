import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge, Ruler, AlertOctagon, Filter } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { formatTime } from '../../utils/helpers';
import type { TideUnit } from '../../types';

const unitOptions: { value: 'all' | TideUnit | 'mixed'; label: string }[] = [
  { value: 'all', label: '全部单位' },
  { value: 'm', label: '米 (m)' },
  { value: 'cm', label: '厘米 (cm)' },
  { value: 'ft', label: '英尺 (ft)' },
  { value: 'mixed', label: '⚠ 单位混写' },
];

const anomalyOptions: { value: 'all' | 'anomaly' | 'normal'; label: string; icon?: React.ElementType }[] = [
  { value: 'all', label: '全部' },
  { value: 'anomaly', label: '仅异常', icon: AlertOctagon },
  { value: 'normal', label: '仅正常' },
];

const TimeControlBar: React.FC = () => {
  const {
    getCurrentStationRecords,
    isPlaying,
    togglePlay,
    playSpeed,
    setPlaySpeed,
    currentTimeIndex,
    setCurrentTimeIndex,
    unitFilter,
    setUnitFilter,
    anomalyFilter,
    setAnomalyFilter,
  } = useAppStore();

  const records = getCurrentStationRecords();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && records.length > 0) {
      timerRef.current = window.setInterval(() => {
        setCurrentTimeIndex((currentTimeIndex + 1) % records.length);
      }, 1000 / playSpeed);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, playSpeed, records.length, currentTimeIndex, setCurrentTimeIndex]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTimeIndex(parseInt(e.target.value, 10));
  };

  const skipBack = () => {
    setCurrentTimeIndex(Math.max(0, currentTimeIndex - 6));
  };

  const skipForward = () => {
    setCurrentTimeIndex(Math.min(records.length - 1, currentTimeIndex + 6));
  };

  const currentRecord = records[currentTimeIndex];
  const progress = records.length > 0 ? (currentTimeIndex / (records.length - 1)) * 100 : 0;

  return (
    <div className="h-24 glass-panel border-t border-ocean-400/20 px-6 flex items-center gap-6 relative z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={skipBack}
          className="w-9 h-9 rounded-lg bg-deep-sea-800 border border-ocean-400/20 flex items-center justify-center text-slate-300 hover:text-ocean-400 hover:border-ocean-400/40 transition-all"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={togglePlay}
          className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all shadow-lg ${
            isPlaying
              ? 'bg-gradient-to-br from-anomaly-500 to-anomaly-400 text-white shadow-anomaly-500/30'
              : 'bg-gradient-to-br from-ocean-500 to-ocean-400 text-white shadow-ocean-500/30'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button
          onClick={skipForward}
          className="w-9 h-9 rounded-lg bg-deep-sea-800 border border-ocean-400/20 flex items-center justify-center text-slate-300 hover:text-ocean-400 hover:border-ocean-400/40 transition-all"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 ml-3">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">速度:</span>
          {[0.5, 1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                playSpeed === speed
                  ? 'bg-ocean-400/20 border border-ocean-400/40 text-ocean-400'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
          <span>{records[0] ? formatTime(records[0].timestamp) : '--:--'}</span>
          <span className="text-ocean-400 font-medium">
            {currentRecord ? formatTime(currentRecord.timestamp) : '--:--'}
          </span>
          <span>{records[records.length - 1] ? formatTime(records[records.length - 1].timestamp) : '--:--'}</span>
        </div>
        <div className="relative h-2">
          <div className="absolute inset-0 bg-deep-sea-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ocean-500 to-ocean-400 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
            {records.map((r, i) => (
              r.isAnomaly && (
                <div
                  key={r.id}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-anomaly-500 anomaly-pulse"
                  style={{ left: `${(i / (records.length - 1)) * 100}%` }}
                />
              )
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, records.length - 1)}
            value={currentTimeIndex}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ocean-400 border-2 border-white shadow-lg shadow-ocean-400/50 pointer-events-none transition-all duration-200"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-slate-400" />
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value as typeof unitFilter)}
            className="bg-deep-sea-800 border border-ocean-400/20 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-ocean-400 transition-all"
          >
            {unitOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 bg-deep-sea-800/60 rounded-lg p-1 border border-ocean-400/10">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
          {anomalyOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = anomalyFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAnomalyFilter(opt.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-deep-sea-700 text-ocean-400 border border-ocean-400/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {Icon && <Icon className="w-3 h-3 text-anomaly-400" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimeControlBar;
