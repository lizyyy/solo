import React from 'react';
import { AlertTriangle, Camera, Database, History, MapPin } from 'lucide-react';
import type { PointData } from '../../types';
import {
  statusLabels,
  sourceLabels,
  conflictTypeLabels,
  formatTimestamp,
  getStatusBgClass,
  getSourceBgClass,
} from '../../utils/helpers';

interface PointCardProps {
  point: PointData;
  isSelected: boolean;
  onClick: () => void;
}

export const PointCard: React.FC<PointCardProps> = ({ point, isSelected, onClick }) => {
  const hasConflict = point.conflict && !point.conflict.resolved;
  const latestProc = point.processHistory[point.processHistory.length - 1];

  return (
    <div
      onClick={onClick}
      className={`p-3 border transition-all cursor-pointer ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50'
          : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs border ${getStatusBgClass(point.status)}`}>
            {statusLabels[point.status]}
          </span>
          {hasConflict && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs border border-orange-500/30 bg-orange-500/10 text-orange-400">
              <AlertTriangle size={10} />
              {conflictTypeLabels[point.conflict!.type]}
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 text-xs border ${getSourceBgClass(point.source)}`}>
          {point.source === 'photo' && <Camera size={10} className="inline mr-1" />}
          {point.source === 'system' && <Database size={10} className="inline mr-1" />}
          {sourceLabels[point.source]}
        </span>
      </div>

      <h4 className="text-slate-200 text-sm font-medium mb-1">{point.deviceName}</h4>

      <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
        <MapPin size={10} />
        <span className="font-mono">
          {point.position.floor}层 ({point.position.x.toFixed(1)}, {point.position.y.toFixed(1)},{' '}
          {point.position.z.toFixed(1)})
        </span>
      </div>

      <div className="text-xs text-slate-500 border-t border-slate-700/50 pt-2">
        <div className="flex items-center gap-1 mb-1">
          <History size={10} />
          <span>来源: {point.sourceRef}</span>
        </div>
        {latestProc && (
          <div className="text-slate-400 truncate">
            {formatTimestamp(latestProc.timestamp)} · {latestProc.remark}
          </div>
        )}
      </div>

      {point.anomalyType === 'historical_supplement' && (
        <div className="mt-2 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 border border-orange-500/20">
          历史照片补录记录
        </div>
      )}

      {point.crossFloor && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 border border-red-500/20">
          ⚡ 跨楼层异常 · {point.crossFloor.description}
        </div>
      )}
    </div>
  );
};
