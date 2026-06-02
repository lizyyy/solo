import { AlertTriangle, MapPin, Clock, Users, Database, XCircle } from 'lucide-react';
import type { ConflictInfo } from '@shared/types';

interface ConflictCardProps {
  conflict: ConflictInfo;
  compact?: boolean;
}

const CONFLICT_ICONS: Record<string, typeof AlertTriangle> = {
  same_name: Users,
  duplicate: XCircle,
  coord_offset: MapPin,
  cross_time: Clock,
  capacity: Database,
  time_conflict: Clock,
};

const CONFLICT_LABELS: Record<string, string> = {
  same_name: '同名路口',
  duplicate: '重复投诉',
  coord_offset: '坐标偏移',
  cross_time: '跨时段统计',
  capacity: '容量超限',
  time_conflict: '时段冲突',
};

export function ConflictCard({ conflict, compact = false }: ConflictCardProps) {
  const Icon = CONFLICT_ICONS[conflict.type] || AlertTriangle;
  const label = CONFLICT_LABELS[conflict.type] || '异常';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="conflict-card mb-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-orange-800">{label}</span>
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              {conflict.type}
            </span>
          </div>
          <p className="text-sm text-orange-900 leading-relaxed">{conflict.humanMessage}</p>
          {conflict.details && (
            <div className="mt-2 text-xs font-mono text-orange-700 bg-orange-100 p-2 rounded">
              坐标偏移：约 {conflict.details.distanceMeters} 米
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
