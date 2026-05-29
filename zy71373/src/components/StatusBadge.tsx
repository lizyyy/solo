import { CheckCircle, FileText } from 'lucide-react';
import type { EntityStatus } from '../types';

interface StatusBadgeProps {
  status: EntityStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const isConfirmed = status === 'confirmed';
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5'
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} rounded-md font-medium transition-all duration-200 ${
        isConfirmed
          ? 'bg-[rgba(67,160,71,0.15)] text-[#43A047] border border-[#43A047]'
          : 'bg-[rgba(158,158,158,0.1)] text-[#757575] border border-dashed border-[#9E9E9E]'
      }`}
    >
      {isConfirmed ? (
        <CheckCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      ) : (
        <FileText className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      )}
      {isConfirmed ? '已确认' : '临时备注'}
    </span>
  );
}
