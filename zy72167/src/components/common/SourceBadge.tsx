import type { SourceType } from '@/types';
import { SOURCE_TYPE_LABELS } from '@/types';
import { FileText, Camera, FileCheck, Edit3 } from 'lucide-react';

const sourceIcons: Record<SourceType, typeof FileText> = {
  street_form: FileText,
  inspection_photo: Camera,
  approval_record: FileCheck,
  manual_supplement: Edit3,
};

const sourceColors: Record<SourceType, string> = {
  street_form: 'bg-blue-50 text-blue-700 border-blue-200',
  inspection_photo: 'bg-purple-50 text-purple-700 border-purple-200',
  approval_record: 'bg-green-50 text-green-700 border-green-200',
  manual_supplement: 'bg-orange-50 text-orange-700 border-orange-200',
};

interface SourceBadgeProps {
  sourceType: SourceType;
  className?: string;
}

export default function SourceBadge({ sourceType, className = '' }: SourceBadgeProps) {
  const Icon = sourceIcons[sourceType];
  
  return (
    <span className={`status-badge ${sourceColors[sourceType]} gap-1.5 ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {SOURCE_TYPE_LABELS[sourceType]}
    </span>
  );
}
