import React from 'react';
import { CHANGE_TYPE_CONFIG } from 'shared/constants';
import type { ChangeType } from 'shared/types';

interface ChangeTypeBadgeProps {
  type: ChangeType;
}

const ChangeTypeBadge: React.FC<ChangeTypeBadgeProps> = ({ type }) => {
  const config = CHANGE_TYPE_CONFIG[type];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
      title={config.description}
    >
      {type === 'material_only' ? '补' : '改'}
      {config.label}
    </span>
  );
};

export default ChangeTypeBadge;
