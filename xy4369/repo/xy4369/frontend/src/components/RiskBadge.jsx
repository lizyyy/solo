import React from 'react';
import { getRiskLevelLabel, getRiskBadgeClass } from '../utils/helpers';

const RiskBadge = ({ level, showLabel = true, className = '' }) => {
  const badgeClass = getRiskBadgeClass(level);
  const label = getRiskLevelLabel(level);

  return (
    <span className={`risk-badge ${badgeClass} ${className}`}>
      {showLabel && label}
    </span>
  );
};

export default RiskBadge;
