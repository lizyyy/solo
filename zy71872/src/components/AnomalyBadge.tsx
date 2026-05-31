import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { AnomalyType, AnomalySeverity } from '../types';
import { getAnomalyTypeLabel } from '../services/anomalyService';

interface AnomalyBadgeProps {
  type: AnomalyType;
  severity: AnomalySeverity;
  showLabel?: boolean;
}

const severityConfig: Record<AnomalySeverity, { icon: typeof AlertCircle; color: string }> = {
  info: { icon: Info, color: 'text-blue-400' },
  warning: { icon: AlertTriangle, color: 'text-amber-400' },
  error: { icon: AlertCircle, color: 'text-red-400' },
};

export function AnomalyBadge({ type, severity, showLabel = true }: AnomalyBadgeProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center space-x-1 ${config.color}`}>
      <Icon className="w-4 h-4" />
      {showLabel && <span className="text-xs">{getAnomalyTypeLabel(type)}</span>}
    </span>
  );
}
