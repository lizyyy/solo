import { AlertTriangle, AlertCircle, Target, XCircle, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';
import { useState } from 'react';
import type { Conflict } from '@/types';

function ConflictItem({ conflict }: { conflict: Conflict }) {
  const [expanded, setExpanded] = useState(false);
  const { focusOnConflict, resolveConflict } = useYardStore();

  const getTypeIcon = () => {
    switch (conflict.type) {
      case 'slot_overlap':
        return <Target className="w-4 h-4" />;
      case 'crane_collision':
        return <AlertCircle className="w-4 h-4" />;
      case 'route_blockage':
        return <AlertTriangle className="w-4 h-4" />;
      case 'port_congestion':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getTypeName = () => {
    switch (conflict.type) {
      case 'slot_overlap':
        return '箱位重叠';
      case 'crane_collision':
        return '吊机冲突';
      case 'route_blockage':
        return '路线堵塞';
      case 'port_congestion':
        return '压港风险';
      default:
        return '未知';
    }
  };

  return (
    <div
      className={`border-l-4 ${
        conflict.severity === 'critical' ? 'border-red-500' : 'border-orange-500'
      } bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer`}
      onClick={() => focusOnConflict(conflict.id)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  conflict.severity === 'critical'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {conflict.severity === 'critical' ? '严重' : '警告'}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                {getTypeIcon()}
                {getTypeName()}
              </span>
            </div>
            <h4 className="text-white text-sm font-medium">{conflict.title}</h4>
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{conflict.description}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 text-slate-400 hover:text-white"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">受影响对象:</p>
              <div className="flex flex-wrap gap-1">
                {conflict.affectedObjectNames.map((name, index) => (
                  <span
                    key={index}
                    className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Database className="w-3 h-3" />
                数据来源:
              </p>
              <div className="flex flex-wrap gap-1">
                {conflict.dataSource.map((source, index) => (
                  <span
                    key={index}
                    className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resolveConflict(conflict.id);
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
              >
                标记已解决
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConflictList() {
  const { getFilteredConflicts } = useYardStore();
  const conflicts = getFilteredConflicts();

  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">没有检测到冲突</p>
        <p className="text-xs text-slate-500 mt-1">系统运行正常</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-slate-400">严重</span>
            <span className="text-sm font-bold text-white">{criticalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs text-slate-400">警告</span>
            <span className="text-sm font-bold text-white">{warningCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {conflicts.map((conflict) => (
          <ConflictItem key={conflict.id} conflict={conflict} />
        ))}
      </div>
    </div>
  );
}
