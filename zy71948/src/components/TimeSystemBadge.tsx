import React from 'react';
import { TimeSystem } from '../types';
import { getTimeSystemShortLabel } from '../utils/timeConverter';

interface TimeSystemBadgeProps {
  timeSystem: TimeSystem;
  showLabel?: boolean;
}

const borderColors: Record<TimeSystem, string> = {
  UTC: 'border-eng-blue',
  TAI: 'border-eng-green',
  BEIJING: 'border-eng-orange'
};

const bgColors: Record<TimeSystem, string> = {
  UTC: 'bg-eng-blue/10',
  TAI: 'bg-eng-green/10',
  BEIJING: 'bg-eng-orange/10'
};

const textColors: Record<TimeSystem, string> = {
  UTC: 'text-eng-blue-light',
  TAI: 'text-eng-green-light',
  BEIJING: 'text-eng-orange-light'
};

export const TimeSystemBadge: React.FC<TimeSystemBadgeProps> = ({ timeSystem, showLabel = true }) => {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-mono border rounded ${borderColors[timeSystem]} ${bgColors[timeSystem]} ${textColors[timeSystem]}`}
      title={`原时间制: ${timeSystem}`}
    >
      {showLabel && getTimeSystemShortLabel(timeSystem)}
    </span>
  );
};
