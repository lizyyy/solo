import { cn } from '@/lib/utils';
import type { RowStatus } from '@/types';

const STATUS_CONFIG: Record<RowStatus, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-tunnel-muted/20 text-tunnel-muted' },
  modified: { label: '已修改', className: 'bg-tunnel-accent/20 text-tunnel-accent' },
  review: { label: '待审核', className: 'bg-tunnel-danger/20 text-tunnel-danger' },
  archived: { label: '已归档', className: 'bg-tunnel-info/20 text-tunnel-info' },
};

export function StatusBadge({ status }: { status: RowStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
