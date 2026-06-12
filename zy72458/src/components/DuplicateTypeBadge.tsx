import { DUPLICATE_TYPE_LABELS, DUPLICATE_TYPE_COLORS, DuplicateType } from '../../shared/types';

interface Props {
  type: DuplicateType | undefined;
}

export default function DuplicateTypeBadge({ type }: Props) {
  const t: DuplicateType = type || 'none';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DUPLICATE_TYPE_COLORS[t]}`}>
      {DUPLICATE_TYPE_LABELS[t]}
    </span>
  );
}
