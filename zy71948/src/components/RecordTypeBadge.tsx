import React from 'react';
import { RecordType } from '../types';

interface RecordTypeBadgeProps {
  recordType: RecordType | 'FAULT_OCCUR';
}

const configs: Record<string, { label: string; className: string }> = {
  SUPPLEMENT: {
    label: '补材料',
    className: 'border-dashed border-console-muted text-console-muted bg-console-muted/10'
  },
  REAL_CHANGE: {
    label: '真修改',
    className: 'border-solid border-eng-blue text-eng-blue-light bg-eng-blue/10'
  },
  FAULT_OCCUR: {
    label: '故障发生',
    className: 'border-solid border-eng-orange text-eng-orange-light bg-eng-orange/10'
  }
};

export const RecordTypeBadge: React.FC<RecordTypeBadgeProps> = ({ recordType }) => {
  const config = configs[recordType] || configs.REAL_CHANGE;
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded ${config.className}`}
    >
      {config.label}
    </span>
  );
};
