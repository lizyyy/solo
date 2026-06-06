import { CheckCircle, Clock, Edit3, AlertTriangle, RefreshCw } from 'lucide-react';
import { BatchStatus, TrackStatus, SceneType } from '@/types';

interface StatusBadgeProps {
  status: BatchStatus | TrackStatus;
  sceneType?: SceneType;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  normal: { label: '正常', color: 'bg-forest-700/80 text-forest-100', icon: CheckCircle },
  pending_review: { label: '待录音师复核', color: 'bg-orange-600/80 text-orange-100', icon: Clock },
  supplemented: { label: '已补录', color: 'bg-gray-600/80 text-gray-100', icon: Edit3 },
  removed: { label: '下架', color: 'bg-red-700/80 text-red-100', icon: AlertTriangle },
  updated: { label: '已修正', color: 'bg-blue-600/80 text-blue-100', icon: Edit3 },
  processing: { label: '处理中', color: 'bg-yellow-600/80 text-yellow-100', icon: RefreshCw },
  completed: { label: '已完成', color: 'bg-forest-700/80 text-forest-100', icon: CheckCircle },
};

const sceneLabels: Record<SceneType, string> = {
  smooth: '顺利记录',
  mixed_tickets: '混批场景',
  old_standard: '旧口径补录',
};

export const StatusBadge = ({ status, sceneType, size = 'md' }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.normal;
  const Icon = config.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding} ${config.color}`}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {config.label}
      {sceneType && (
        <span className="ml-1 opacity-70 text-[10px]">
          · {sceneLabels[sceneType]}
        </span>
      )}
    </span>
  );
};
