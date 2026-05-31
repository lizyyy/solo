import React from 'react';
import { Info } from 'lucide-react';

interface ProcessingBadgeProps {
  rule: string;
  showIcon?: boolean;
}

export const ProcessingBadge: React.FC<ProcessingBadgeProps> = ({ rule, showIcon = true }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-graphite-light text-xs rounded-md">
      {showIcon && <Info size={12} className="text-space-blue" />}
      <span className="truncate max-w-xs">{rule}</span>
    </span>
  );
};
