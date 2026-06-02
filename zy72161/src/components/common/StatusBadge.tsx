import React from 'react';
import { ShelterStatus, shelterStatusLabels, ConflictType, conflictTypeLabels } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ShelterStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const colorMap: Record<ShelterStatus, string> = {
    [ShelterStatus.PROCESSED]: 'bg-green-500/20 text-green-400 border-green-500/40',
    [ShelterStatus.PENDING_VERIFY]: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    [ShelterStatus.ONSITE_CHECK]: 'bg-red-500/20 text-red-400 border-red-500/40'
  };

  const sizeMap = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      colorMap[status],
      sizeMap[size]
    )}>
      <span className={cn(
        'rounded-full',
        status === ShelterStatus.PROCESSED && 'bg-green-400',
        status === ShelterStatus.PENDING_VERIFY && 'bg-orange-400',
        status === ShelterStatus.ONSITE_CHECK && 'bg-red-400',
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      )} />
      {shelterStatusLabels[status]}
    </span>
  );
};

interface ConflictTypeBadgeProps {
  type: ConflictType;
  size?: 'sm' | 'md' | 'lg';
}

export const ConflictTypeBadge: React.FC<ConflictTypeBadgeProps> = ({ type, size = 'md' }) => {
  const colorMap: Record<ConflictType, string> = {
    [ConflictType.NONE]: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    [ConflictType.CAPACITY]: 'bg-red-500/20 text-red-400 border-red-500/40',
    [ConflictType.COORDINATE]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    [ConflictType.TIME]: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    [ConflictType.MIXED]: 'bg-purple-500/20 text-purple-400 border-purple-500/40'
  };

  const sizeMap = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      colorMap[type],
      sizeMap[size]
    )}>
      {conflictTypeLabels[type]}
    </span>
  );
};
