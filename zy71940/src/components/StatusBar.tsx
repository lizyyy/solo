import { Clock, Database, HardDrive, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime } from '@/utils/timeUtils';

export function StatusBar() {
  const { view, windows, conflicts, lastSavedAt } = useAppStore();
  const timeSystems = new Set(windows.map(w => w.timeSystem));
  const hasMixedTimeSystems = timeSystems.size > 1;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-space-900 border-t border-tech-cyan/20 text-xs">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock size={12} />
          <span>视图范围:</span>
          <span className="text-tech-cyan font-mono">
            {formatDateTime(view.startTime).slice(0, 16)} ~ {formatDateTime(view.endTime).slice(0, 16)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Database size={12} />
          <span>时间制式:</span>
          <span className={`font-mono ${hasMixedTimeSystems ? 'text-tech-orange' : 'text-tech-green'}`}>
            {Array.from(timeSystems).join('/')}
            {hasMixedTimeSystems && (
              <AlertTriangle size={12} className="inline ml-1" />
            )}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-gray-400">
          <HardDrive size={12} />
          <span>上次保存:</span>
          <span className="text-gray-300 font-mono">
            {lastSavedAt ? formatDateTime(lastSavedAt) : '未保存'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            缩放: <span className="text-tech-cyan">{(view.zoom * 100).toFixed(0)}%</span>
          </span>
          <span className="text-gray-400">
            窗口: <span className="text-tech-cyan">{windows.length}</span>
          </span>
          <span className="text-gray-400">
            冲突: <span className={conflicts.some(c => c.status === 'DETECTED') ? 'text-tech-red' : 'text-tech-green'}>
              {conflicts.filter(c => c.status === 'DETECTED').length}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
