import { MapPin, Clock, User } from 'lucide-react';
import type { Point } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { formatCoordinate, formatChangeRate } from '../../utils/coordinate';

interface PointListProps {
  points: Point[];
  selectedPointId: string | null;
  onPointClick: (point: Point) => void;
}

export function PointList({ points, selectedPointId, onPointClick }: PointListProps) {
  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <MapPin size={32} className="mb-3 opacity-50" />
        <p className="text-sm">暂无匹配的点位</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {points.map((point) => {
        const isSelected = selectedPointId === point.id;
        
        return (
          <div
            key={point.id}
            onClick={() => onPointClick(point)}
            className="p-3 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              border: isSelected
                ? '1px solid rgba(59, 130, 246, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: isSelected ? '0 4px 20px rgba(59, 130, 246, 0.15)' : 'none',
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4
                  className="text-sm font-semibold text-white truncate mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {point.name}
                </h4>
                <div className="flex items-center text-[11px] text-gray-400">
                  <MapPin size={10} className="mr-1" />
                  <span className="truncate">{formatCoordinate(point.lat, point.lng)}</span>
                </div>
              </div>
              <StatusBadge
                status={point.status}
                isAnomaly={point.isAnomaly}
                size="sm"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center">
                  <span
                    className="w-1.5 h-1.5 rounded-full mr-1"
                    style={{
                      backgroundColor: point.changeRate > 0 ? '#10b981' : '#ef4444',
                    }}
                  />
                  {point.changeType}
                  <span
                    className="ml-1 font-medium"
                    style={{
                      color: point.changeRate > 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {formatChangeRate(point.changeRate)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500">
              <span className="flex items-center">
                <User size={10} className="mr-1" />
                {point.handler}
              </span>
              <span className="flex items-center">
                <Clock size={10} className="mr-1" />
                {point.handledAt.slice(5, 16)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
