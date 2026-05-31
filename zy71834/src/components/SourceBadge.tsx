import type { SourceType } from '@/types';
import { getSourceTypeLabel } from '@/utils/parser';
import { FileText, Clock, Copy, Edit3 } from 'lucide-react';

interface SourceBadgeProps {
  type: SourceType;
}

export const SourceBadge = ({ type }: SourceBadgeProps) => {
  const badgeClass = {
    normal: 'badge-normal',
    late_attachment: 'badge-late',
    duplicate: 'badge-duplicate',
    manual_correction: 'badge-manual',
  }[type];

  const Icon = {
    normal: FileText,
    late_attachment: Clock,
    duplicate: Copy,
    manual_correction: Edit3,
  }[type];

  return (
    <span className={`badge ${badgeClass} gap-1`}>
      <Icon size={12} />
      {getSourceTypeLabel(type)}
    </span>
  );
};
