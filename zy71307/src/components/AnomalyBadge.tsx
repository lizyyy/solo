import React from 'react';
import { AlertTriangle, XCircle, AlertOctagon } from 'lucide-react';
import type { AnomalySeverity } from '@/types';
import { getAnomalyTypeLabel } from '@/utils/anomaly';

interface AnomalyBadgeProps {
  type: string;
  severity: AnomalySeverity;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const severityConfig = {
  warning: {
    bg: 'bg-alert-orange/10',
    border: 'border-alert-orange/30',
    text: 'text-alert-orange',
    icon: AlertTriangle,
    pulse: 'animate-pulse-slow',
  },
  error: {
    bg: 'bg-alert-yellow/10',
    border: 'border-alert-yellow/30',
    text: 'text-alert-yellow',
    icon: XCircle,
    pulse: 'animate-pulse-slow',
  },
  critical: {
    bg: 'bg-alert-red/10',
    border: 'border-alert-red/30',
    text: 'text-alert-red',
    icon: AlertOctagon,
    pulse: 'animate-pulse-slow',
  },
};

export const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({
  type,
  severity,
  showLabel = true,
  size = 'md',
}) => {
  const config = severityConfig[severity];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded ${config.bg} ${config.border} border ${config.text} font-mono text-xs`}
    >
      <Icon size={iconSize} className={config.pulse} />
      {showLabel && <span>{getAnomalyTypeLabel(type)}</span>}
    </span>
  );
};
