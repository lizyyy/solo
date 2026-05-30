import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { ConflictType, ChangeType } from '@/../shared/types';
import { CONFLICT_TYPE_LABELS, CHANGE_TYPE_LABELS, EMOTION_TAG_LABELS, EMOTION_TAG_COLORS } from '@/../shared/types';

interface StatusBadgeProps {
  type: 'conflict' | 'resolved' | 'pending' | 'active' | 'removed';
  label?: string;
  className?: string;
}

export function StatusBadge({ type, label, className }: StatusBadgeProps) {
  const icons = {
    conflict: XCircle,
    resolved: CheckCircle,
    pending: Clock,
    active: CheckCircle,
    removed: XCircle,
  };

  const styles = {
    conflict: 'status-conflict',
    resolved: 'status-resolved',
    pending: 'status-pending',
    active: 'status-active',
    removed: 'status-conflict',
  };

  const defaultLabels = {
    conflict: '冲突',
    resolved: '已解决',
    pending: '待处理',
    active: '正常',
    removed: '已下架',
  };

  const Icon = icons[type];

  return (
    <span className={cn(styles[type], className)}>
      <Icon className="w-3 h-3 mr-1" />
      {label || defaultLabels[type]}
    </span>
  );
}

interface ConflictTypeBadgeProps {
  conflictType: ConflictType;
  severity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function ConflictTypeBadge({ conflictType, severity = 'medium', className }: ConflictTypeBadgeProps) {
  const severityStyles = {
    low: 'bg-deep-blue-500/20 text-deep-blue-200 border-deep-blue-400/30',
    medium: 'bg-amber-yellow-500/20 text-amber-yellow-400 border-amber-yellow-500/30',
    high: 'bg-coral-red-500/20 text-coral-red-400 border-coral-red-500/30',
  };

  return (
    <span className={cn('status-badge border', severityStyles[severity], className)}>
      <AlertTriangle className="w-3 h-3 mr-1" />
      {CONFLICT_TYPE_LABELS[conflictType]}
    </span>
  );
}

interface ChangeTypeBadgeProps {
  changeType: ChangeType;
  className?: string;
}

export function ChangeTypeBadge({ changeType, className }: ChangeTypeBadgeProps) {
  const styles = {
    new: 'bg-emerald-green-500/20 text-emerald-green-400 border border-emerald-green-500/30',
    updated: 'bg-neon-purple-500/20 text-neon-purple-300 border border-neon-purple-500/30',
    unchanged: 'bg-deep-blue-500/20 text-deep-blue-300 border border-deep-blue-400/30',
    removed: 'bg-coral-red-500/20 text-coral-red-400 border border-coral-red-500/30',
  };

  return (
    <span className={cn('status-badge', styles[changeType], className)}>
      {CHANGE_TYPE_LABELS[changeType]}
    </span>
  );
}

interface EmotionTagBadgeProps {
  emotion: string;
  className?: string;
}

export function EmotionTagBadge({ emotion, className }: EmotionTagBadgeProps) {
  const color = EMOTION_TAG_COLORS[emotion as keyof typeof EMOTION_TAG_COLORS] || '#64748B';
  const label = EMOTION_TAG_LABELS[emotion as keyof typeof EMOTION_TAG_LABELS] || emotion;

  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', className)}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}
