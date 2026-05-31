import type { AnomalyType, ConfirmStatus } from '@/types';
import { getAnomalyTypeLabel } from '@/utils/parser';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface AnomalyBadgeProps {
  type: AnomalyType;
  status: ConfirmStatus;
  severity?: 'warning' | 'critical';
}

export const AnomalyBadge = ({ type, status, severity }: AnomalyBadgeProps) => {
  const badgeClass = status === 'pending' ? 'badge-pending' : 'badge-confirmed';
  const Icon = status === 'pending' ? AlertTriangle : CheckCircle;

  return (
    <span className={`badge ${badgeClass} gap-1 ${severity === 'critical' ? 'border-red-500' : ''}`}>
      <Icon size={12} />
      {getAnomalyTypeLabel(type)}
      {status === 'pending' ? ' · 待确认' : ' · 已确认'}
    </span>
  );
};
