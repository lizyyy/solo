import { Clock, AlertTriangle } from 'lucide-react';

interface LateBadgeProps {
  type?: 'photo' | 'attachment';
  compact?: boolean;
}

export function LateBadge({ type = 'photo', compact = false }: LateBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 text-red-700 font-medium ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      title={type === 'photo' ? '该照片晚于工单完成后上传' : '该附件晚于工单完成后上传'}
    >
      <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {compact ? '晚传' : '晚到附件'}
      <AlertTriangle className={compact ? 'w-2.5 h-2.5 text-orange-500' : 'w-3 h-3 text-orange-500'} />
    </span>
  );
}
