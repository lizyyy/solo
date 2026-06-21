import React from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import type { Anomaly, InspectionRecord } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ANOMALY_TYPE_LABELS } from '../../types';
import { formatPosition } from '../../utils/coordinate';

interface HoverTooltipProps {
  anomaly: Anomaly | null;
  record: InspectionRecord | undefined;
  position: { x: number; y: number };
}

export function HoverTooltip({ anomaly, record, position }: HoverTooltipProps) {
  if (!anomaly) return null;
  
  const statusColor = STATUS_COLORS[anomaly.status];
  const statusLabel = STATUS_LABELS[anomaly.status];
  const typeLabel = ANOMALY_TYPE_LABELS[anomaly.type];
  
  return (
    <div
      className="fixed z-50 pointer-events-none bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-2xl min-w-48"
      style={{
      left: position.x + 15,
      top: position.y + 15,
      transform: 'translate3d(0,0,0)',
    }}
  >
    <div className="flex items-center gap-2 mb-2">
      <div
        className="w-8 h-8 rounded flex items-center justify-center"
        style={{ backgroundColor: statusColor + '20' }}
      >
        <AlertTriangle className="w-4 h-4" style={{ color: statusColor }} />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-200">{typeLabel}</div>
        <div className="text-xs" style={{ color: statusColor }}>{statusLabel}</div>
      </div>
    </div>
    
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <MapPin className="w-3 h-3 text-slate-500" />
        <span className="text-slate-500">位置:</span>
        <span className="text-slate-300 font-mono">
          {formatPosition(anomaly.reportedPosition)}
        </span>
      </div>
      {record && (
        <div className="text-xs text-slate-500">
          设备: <span className="text-slate-300">{record.deviceName}</span>
        </div>
      )}
      {anomaly.offsetDistance && (
        <div className="text-xs text-red-400">
          偏移: {anomaly.offsetDistance.toFixed(2)}m
        </div>
      )}
      {anomaly.nullField && (
        <div className="text-xs text-pink-400">
          空值: {anomaly.nullField}
        </div>
      )}
      {anomaly.isCrossFloor && (
        <div className="text-xs text-purple-400">
          跨楼层: {anomaly.relatedFloor?.join('、')}
        </div>
      )}
    </div>
    </div>
  );
}
