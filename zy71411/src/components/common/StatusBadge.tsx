import React from 'react';
import { Tag } from 'antd';
import { STATUS_LABELS } from '@/utils/constants';

interface StatusBadgeProps {
  status: string;
  type?: 'contract' | 'application' | 'payment' | 'validation';
  showLabel?: boolean;
}

const colorMap: Record<string, string> = {
  active: 'green',
  rolled: 'blue',
  matured: 'default',
  cancelled: 'red',
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  unmatched: 'orange',
  matched: 'green',
  duplicate: 'red',
  pass: 'green',
  warning: 'orange',
  error: 'red',
  info: 'blue',
  premium: 'green',
  discount: 'orange',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showLabel = true }) => {
  const color = colorMap[status] || 'default';
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;

  return (
    <Tag color={color} className="m-0">
      {showLabel ? label : ''}
    </Tag>
  );
};

export default StatusBadge;
