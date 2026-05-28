import React from 'react';
import { DataSource, DATA_SOURCE_LABELS, DATA_SOURCE_COLORS } from '../../game/types';

interface SourceBadgeProps {
  source: DataSource;
  showLabel?: boolean;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, showLabel = true, className = '' }) => {
  const colorClass = DATA_SOURCE_COLORS[source];
  const label = DATA_SOURCE_LABELS[source];

  return (
    <span className={`source-badge ${colorClass} ${className}`}>
      {showLabel && label}
    </span>
  );
};
