import ConflictBadge from './ConflictBadge';
import type { ConflictType } from '@/types';

interface ConflictTagListProps {
  conflicts: ConflictType[];
  maxVisible?: number;
}

export default function ConflictTagList({ conflicts, maxVisible = 2 }: ConflictTagListProps) {
  if (conflicts.length === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-success-500/10 text-success-600 border border-success-500/30">
        正常
      </span>
    );
  }

  const visible = conflicts.slice(0, maxVisible);
  const hidden = conflicts.slice(maxVisible);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((type) => (
        <ConflictBadge key={type} type={type} />
      ))}
      {hidden.length > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-600 border border-neutral-300">
          +{hidden.length}
        </span>
      )}
    </div>
  );
}
