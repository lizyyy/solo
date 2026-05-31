import { sourceLabels } from '@/types';
import type { RecordSource } from '@/types';
import { getSourceIcon } from '@/utils/helpers';

interface SourceLabelProps {
  source: RecordSource;
  showIcon?: boolean;
  className?: string;
}

export default function SourceLabel({ source, showIcon = true, className = '' }: SourceLabelProps) {
  return (
    <span className={`inline-flex items-center text-sm ${className}`}>
      {showIcon && <span className="mr-1.5">{getSourceIcon(source)}</span>}
      {sourceLabels[source]}
    </span>
  );
}
