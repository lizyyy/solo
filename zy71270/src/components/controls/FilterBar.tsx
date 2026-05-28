import { useMemo } from 'react';
import {
  Clock,
  Layers,
  Users,
  Building2,
  Route,
  Flame,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDataStore, useFilterStore } from '../../store';
import ToggleSwitch from '../common/ToggleSwitch';
import dayjs from 'dayjs';

export default function FilterBar() {
  const robots = useDataStore((s) => s.robots);
  const orderWaves = useDataStore((s) => s.orderWaves);

  const timeRange = useFilterStore((s) => s.timeRange);
  const setTimeRange = useFilterStore((s) => s.setTimeRange);
  const selectedWaveId = useFilterStore((s) => s.selectedWaveId);
  const setSelectedWaveId = useFilterStore((s) => s.setSelectedWaveId);
  const selectedRobotIds = useFilterStore((s) => s.selectedRobotIds);
  const toggleRobotId = useFilterStore((s) => s.toggleRobotId);
  const selectedFloor = useFilterStore((s) => s.selectedFloor);
  const setSelectedFloor = useFilterStore((s) => s.setSelectedFloor);
  const showPaths = useFilterStore((s) => s.showPaths);
  const toggleShowPaths = useFilterStore((s) => s.toggleShowPaths);
  const showHeatmap = useFilterStore((s) => s.showHeatmap);
  const toggleShowHeatmap = useFilterStore((s) => s.toggleShowHeatmap);
  const showQueue = useFilterStore((s) => s.showQueue);
  const toggleShowQueue = useFilterStore((s) => s.toggleShowQueue);

  const timeStart = timeRange.start;
  const timeEnd = timeRange.end;
  const timeRangeMs = timeEnd - timeStart;

  const floorOptions = useMemo(() => [1, 2, 3], []);

  return (
    <div className="glass rounded-lg px-4 py-3 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2 min-w-[280px]">
        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{dayjs(timeStart).format('MM/DD HH:mm')}</span>
            <span>{dayjs(timeEnd).format('MM/DD HH:mm')}</span>
          </div>
          <div className="relative h-1.5 bg-slate-700 rounded-full">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-path-cyan to-accent-blue"
              style={{ width: '100%' }}
            />
            <input
              type="range"
              min={timeStart}
              max={timeEnd}
              value={timeStart}
              onChange={(e) =>
                setTimeRange({
                  start: Number(e.target.value),
                  end: timeEnd,
                })
              }
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              title="时间起点"
            />
            <input
              type="range"
              min={timeStart}
              max={timeEnd}
              value={timeEnd}
              onChange={(e) =>
                setTimeRange({
                  start: timeStart,
                  end: Number(e.target.value),
                })
              }
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              title="时间终点"
            />
          </div>
        </div>
      </div>

      <div className="w-px h-6 bg-warehouse-border/50" />

      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-slate-400" />
        <select
          value={selectedWaveId ?? ''}
          onChange={(e) =>
            setSelectedWaveId(e.target.value || null)
          }
          className="input text-xs py-1.5 px-2 min-w-[120px]"
        >
          <option value="">全部波次</option>
          {orderWaves.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-px h-6 bg-warehouse-border/50" />

      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1 flex-wrap max-w-[260px]">
          {robots.map((r) => (
            <button
              key={r.id}
              onClick={() => toggleRobotId(r.id)}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-mono transition-all border',
                selectedRobotIds.includes(r.id)
                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40'
                  : 'bg-warehouse-surface text-slate-400 border-warehouse-border/50 hover:border-slate-500'
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-6 bg-warehouse-border/50" />

      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1">
          {floorOptions.map((f) => (
            <button
              key={f}
              onClick={() =>
                setSelectedFloor(selectedFloor === f ? null : f)
              }
              className={cn(
                'px-2.5 py-1 rounded text-xs font-mono transition-all border',
                selectedFloor === f
                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40'
                  : 'bg-warehouse-surface text-slate-400 border-warehouse-border/50 hover:border-slate-500'
              )}
            >
              {f}F
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-6 bg-warehouse-border/50" />

      <div className="flex items-center gap-3">
        <ToggleSwitch
          checked={showPaths}
          onChange={toggleShowPaths}
          label="路径"
        />
        <ToggleSwitch
          checked={showHeatmap}
          onChange={toggleShowHeatmap}
          label="热力"
        />
        <ToggleSwitch
          checked={showQueue}
          onChange={toggleShowQueue}
          label="排队"
        />
      </div>
    </div>
  );
}
