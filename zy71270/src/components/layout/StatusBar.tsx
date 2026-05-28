import { useMemo } from 'react';
import {
  Bot,
  Archive,
  Zap,
  AlertTriangle,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDataStore, useFilterStore } from '../../store';
import Badge from '../common/Badge';
import dayjs from 'dayjs';

export default function StatusBar() {
  const warehouse = useDataStore((s) => s.warehouse);
  const robots = useDataStore((s) => s.robots);
  const lastSyncTime = useDataStore((s) => s.lastSyncTime);
  const getDataQualityIssues = useDataStore((s) => s.getDataQualityIssues);
  const reloadData = useDataStore((s) => s.reloadData);

  const selectedFloor = useFilterStore((s) => s.selectedFloor);
  const selectedWaveId = useFilterStore((s) => s.selectedWaveId);
  const selectedRobotIds = useFilterStore((s) => s.selectedRobotIds);
  const showPaths = useFilterStore((s) => s.showPaths);
  const showHeatmap = useFilterStore((s) => s.showHeatmap);
  const showQueue = useFilterStore((s) => s.showQueue);

  const shelfCount = useMemo(
    () => warehouse?.floors.reduce((sum, f) => sum + f.shelves.length, 0) ?? 0,
    [warehouse]
  );

  const stationCount = useMemo(
    () =>
      warehouse?.floors.reduce(
        (sum, f) => sum + f.chargingStations.length,
        0
      ) ?? 0,
    [warehouse]
  );

  const qualityIssues = useMemo(() => getDataQualityIssues(), [getDataQualityIssues]);
  const hasErrors = qualityIssues.some((i) => i.severity === 'error');
  const hasWarnings = qualityIssues.some((i) => i.severity === 'warning');

  const qualityDot = hasErrors
    ? 'red'
    : hasWarnings
      ? 'amber'
      : 'green';

  const filterTags = useMemo(() => {
    const tags: string[] = [];
    if (selectedFloor !== null) tags.push(`${selectedFloor}F`);
    if (selectedWaveId) tags.push('波次筛选');
    if (selectedRobotIds.length > 0) tags.push(`${selectedRobotIds.length}台机器人`);
    if (showPaths) tags.push('路径');
    if (showHeatmap) tags.push('热力');
    if (showQueue) tags.push('排队');
    return tags;
  }, [selectedFloor, selectedWaveId, selectedRobotIds, showPaths, showHeatmap, showQueue]);

  return (
    <footer className="glass flex items-center justify-between px-6 h-10 border-t border-warehouse-border/50 text-xs z-50">
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Bot className="w-3.5 h-3.5" />
          <span className="text-slate-200 font-mono">{robots.length}</span> 机器人
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Archive className="w-3.5 h-3.5" />
          <span className="text-slate-200 font-mono">{shelfCount}</span> 货架
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Zap className="w-3.5 h-3.5" />
          <span className="text-slate-200 font-mono">{stationCount}</span> 充电站
        </span>

        <div className="w-px h-4 bg-warehouse-border/50" />

        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          {filterTags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-mono"
            >
              {tag}
            </span>
          ))}
          {filterTags.length === 0 && (
            <span className="text-slate-500">无筛选</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {qualityIssues.length > 0 && (
          <span className="flex items-center gap-1.5 text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-status-amber" />
            <span className="text-status-amber font-mono">{qualityIssues.length}</span> 问题
          </span>
        )}

        <span className="flex items-center gap-1.5">
          <span className={cn('status-dot', qualityDot)} />
          <span className="text-slate-400">
            数据质量: <span className="text-slate-200">{
              hasErrors ? '异常' : hasWarnings ? '警告' : '正常'
            }</span>
          </span>
        </span>

        <span className="text-slate-500">
          刷新: {lastSyncTime
            ? dayjs(lastSyncTime).format('HH:mm:ss')
            : '--:--:--'
          }
        </span>

        <button
          onClick={() => reloadData()}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          title="刷新数据"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
}
