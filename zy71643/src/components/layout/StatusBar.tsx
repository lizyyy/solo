import { Activity, Database, MapPin, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useCollisionStore } from '../../stores/collisionStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';
import { pipelineColors, pipelineTypeLabels } from '../../data/config';

export function StatusBar() {
  const segments = usePipelineStore((state) => state.segments);
  const collisions = useCollisionStore((state) => state.collisions);
  const dataIssues = useCollisionStore((state) => state.dataIssues);
  const notification = useUIStore((state) => state.notification);
  const hideNotification = useUIStore((state) => state.hideNotification);

  const stats = {
    water: segments.filter((s) => s.type === 'water').length,
    electric: segments.filter((s) => s.type === 'electric').length,
    gas: segments.filter((s) => s.type === 'gas').length,
    withWarnings: segments.filter((s) => s.hasWarning).length,
  };

  const collisionStats = {
    pending: collisions.filter((c) => c.status === 'pending').length,
    processing: collisions.filter((c) => c.status === 'processing').length,
    resolved: collisions.filter((c) => c.status === 'resolved').length,
  };

  return (
    <>
      <footer className="h-9 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Database size={12} className="text-blue-400" />
            <span>管线统计:</span>
            {(['water', 'electric', 'gas'] as const).map((type) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: pipelineColors[type] }}
                />
                <span className="text-slate-300">{pipelineTypeLabels[type]}:</span>
                <span className="text-white font-mono">{stats[type]}</span>
              </div>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {stats.withWarnings > 0 && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <AlertTriangle size={12} />
              <span>数据异常: {stats.withWarnings} 段</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {collisions.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock size={12} className="text-red-400" />
                  <span>待处理:</span>
                  <span className="text-red-400 font-mono">{collisionStats.pending}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Activity size={12} className="text-yellow-400" />
                  <span>处理中:</span>
                  <span className="text-yellow-400 font-mono">{collisionStats.processing}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <CheckCircle size={12} className="text-green-400" />
                  <span>已解决:</span>
                  <span className="text-green-400 font-mono">{collisionStats.resolved}</span>
                </div>
              </div>

              <div className="h-4 w-px bg-slate-700" />
            </>
          )}

          {dataIssues.length > 0 && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <AlertTriangle size={12} />
              <span>数据质量问题: {dataIssues.length} 处</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-slate-500">
            <MapPin size={12} />
            <span>坐标系: WGS84 / UTM</span>
          </div>
        </div>
      </footer>

      {notification && (
        <div
          className={cn(
            'fixed bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-[200] flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-4',
            notification.type === 'success' && 'bg-green-600 text-white',
            notification.type === 'warning' && 'bg-yellow-600 text-white',
            notification.type === 'error' && 'bg-red-600 text-white',
            notification.type === 'info' && 'bg-blue-600 text-white'
          )}
        >
          {notification.type === 'success' && <CheckCircle size={14} />}
          {notification.type === 'warning' && <AlertTriangle size={14} />}
          {notification.type === 'error' && <AlertTriangle size={14} />}
          {notification.type === 'info' && <Activity size={14} />}
          {notification.message}
          <button
            onClick={hideNotification}
            className="ml-2 hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
