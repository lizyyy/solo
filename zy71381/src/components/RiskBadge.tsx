import React from 'react';
import type { RiskLevel } from '../types';
import { RISK_LEVEL_LABELS } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const icons: Record<RiskLevel, React.ReactNode> = {
  critical: <AlertCircle className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  safe: <CheckCircle className="w-3 h-3" />,
  unknown: <HelpCircle className="w-3 h-3" />,
};

const badgeClasses: Record<RiskLevel, string> = {
  critical: 'badge-critical',
  warning: 'badge-warning',
  safe: 'badge-safe',
  unknown: 'badge-unknown',
};

export function RiskBadge({ level, showIcon = true, size = 'md' }: RiskBadgeProps) {
  const icon = icons[level];
  const label = RISK_LEVEL_LABELS[level];
  const badgeClass = badgeClasses[level];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0' : '';

  return (
    <span className={`badge ${badgeClass} ${sizeClass} inline-flex items-center gap-1`}>
      {showIcon && icon}
      {label}
    </span>
  );
}
