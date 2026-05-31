import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Plus,
  RefreshCw,
  Route,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  GitCompare,
} from 'lucide-react';
import { HistoryEntry, ActionType } from '../../types';
import { getActionLabel } from '../../utils/export';
import { useRecordsStore } from '../../store/useRecordsStore';
import { cn } from '../../lib/utils';

const actionIcons: Record<ActionType, typeof Plus> = {
  create: Plus,
  status_change: RefreshCw,
  route_modify: Route,
  issue_create: AlertTriangle,
  issue_resolve: CheckCircle,
  note_add: MessageSquare,
};

const actionColors: Record<ActionType, string> = {
  create: 'text-green-400 bg-green-500/20 border-green-500/50',
  status_change: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
  route_modify: 'text-orange-400 bg-orange-500/20 border-orange-500/50',
  issue_create: 'text-red-400 bg-red-500/20 border-red-500/50',
  issue_resolve: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50',
  note_add: 'text-purple-400 bg-purple-500/20 border-purple-500/50',
};

interface HistoryTimelineProps {
  history: HistoryEntry[];
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  const { toggleCompareVersion, compareRouteVersionIds, getSelectedRecordRouteVersions } = useRecordsStore();
  const routeVersions = getSelectedRecordRouteVersions();

  const getVersionFromMetadata = (entry: HistoryEntry): number | null => {
    if (entry.action === 'route_modify' && entry.newState) {
      const match = entry.newState.match(/版本(\d+)/);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  };

  const getVersionId = (version: number): string | undefined => {
    return routeVersions.find((v) => v.version === version)?.id;
  };

  return (
    <div className="space-y-1">
      {history.map((entry, index) => {
        const Icon = actionIcons[entry.action] || MessageSquare;
        const colorClass = actionColors[entry.action] || actionColors.note_add;
        const version = getVersionFromMetadata(entry);
        const versionId = version ? getVersionId(version) : undefined;
        const isSelected = versionId && compareRouteVersionIds.includes(versionId);
        const prevVersion = entry.previousState?.match(/版本(\d+)/)?.[1];
        const prevVersionId = prevVersion ? getVersionId(parseInt(prevVersion)) : undefined;

        return (
          <div key={entry.id} className="relative pl-8 pb-4">
            {index < history.length - 1 && (
              <div className="absolute left-[15px] top-8 w-px h-full bg-slate-700/50" />
            )}
            <div
              className={cn(
                'absolute left-0 top-1 w-8 h-8 rounded-full border flex items-center justify-center',
                colorClass
              )}
            >
              <Icon className="w-4 h-4" />
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-200 text-sm">
                      {getActionLabel(entry.action)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(entry.timestamp), 'MM-dd HH:mm:ss', { locale: zhCN })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    <span className="text-slate-500">操作人:</span>{' '}
                    <span className="text-slate-300">{entry.operator}</span>
                  </p>
                  {entry.reason && (
                    <p className="text-sm text-slate-300 bg-slate-900/50 rounded px-2 py-1">
                      {entry.reason}
                    </p>
                  )}
                  {(entry.previousState || entry.newState) && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {entry.previousState && (
                        <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                          {entry.previousState}
                        </span>
                      )}
                      <span className="text-slate-600">→</span>
                      {entry.newState && (
                        <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                          {entry.newState}
                        </span>
                      )}
                      {entry.action === 'route_modify' && prevVersionId && versionId && (
                        <button
                          onClick={() => {
                            useRecordsStore.getState().clearCompareVersions();
                            toggleCompareVersion(prevVersionId);
                            toggleCompareVersion(versionId);
                          }}
                          className={cn(
                            'ml-auto flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors',
                            isSelected
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'border-slate-600 text-slate-400 hover:border-orange-500/50 hover:text-orange-400'
                          )}
                        >
                          <GitCompare className="w-3 h-3" />
                          对比版本
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {history.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">暂无历史记录</div>
      )}
    </div>
  );
}
