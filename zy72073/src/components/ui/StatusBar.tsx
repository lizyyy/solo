import React from 'react';
import { Camera, Layers, MapPin, AlertTriangle } from 'lucide-react';
import { useStore, useFilteredPoints } from '../../store/useStore';

export const StatusBar: React.FC = () => {
  const { activeFloor, cameraPosition, cameraTarget, points } = useStore();
  const filteredPoints = useFilteredPoints();

  const unresolvedConflicts = points.filter((p) => p.conflict && !p.conflict.resolved).length;

  return (
    <div className="h-8 bg-slate-900/90 border-t border-cyan-500/20 flex items-center justify-between px-4 text-xs font-mono backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Layers size={12} />
          <span>
            楼层: <span className="text-cyan-400">{activeFloor === 0 ? '全部' : `${activeFloor}层`}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin size={12} />
          <span>
            显示: <span className="text-cyan-400">{filteredPoints.length}</span> / {points.length} 个点位
          </span>
        </div>
        {unresolvedConflicts > 0 && (
          <div className="flex items-center gap-2 text-orange-400 animate-pulse">
            <AlertTriangle size={12} />
            <span>{unresolvedConflicts} 个待处理冲突</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 text-slate-500">
        <div className="flex items-center gap-2">
          <Camera size={12} />
          <span>
            相机: ({cameraPosition[0].toFixed(1)}, {cameraPosition[1].toFixed(1)},{' '}
            {cameraPosition[2].toFixed(1)})
          </span>
        </div>
        <div>
          目标: ({cameraTarget[0].toFixed(1)}, {cameraTarget[1].toFixed(1)},{' '}
          {cameraTarget[2].toFixed(1)})
        </div>
      </div>
    </div>
  );
};
