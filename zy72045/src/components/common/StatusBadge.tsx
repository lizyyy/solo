import type { GameStatus } from '../../types/game';
import type { NewsConfidence } from '../../types/game';

interface StatusBadgeProps {
  status: GameStatus | NewsConfidence | string;
  type?: 'game' | 'confidence' | 'source' | 'trade';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: '待开始', className: 'bg-neutral-100 text-neutral-600' },
  playing: { label: '进行中', className: 'bg-success-100 text-success-700' },
  paused: { label: '已暂停', className: 'bg-warning-100 text-warning-700' },
  settled: { label: '已结算', className: 'bg-primary-100 text-primary-700' },
  auto: { label: '自动处理', className: 'bg-success-50 text-success-600 border border-success-200' },
  need_confirm: { label: '待人工确认', className: 'bg-warning-50 text-warning-600 border border-warning-200' },
  manual: { label: '人工处理', className: 'bg-primary-50 text-primary-600 border border-primary-200' },
  buy: { label: '买入', className: 'bg-danger-100 text-danger-700' },
  sell: { label: '卖出', className: 'bg-success-100 text-success-700' },
  hold: { label: '观望', className: 'bg-neutral-100 text-neutral-600' },
};

export function StatusBadge({ status, type = 'game' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-neutral-100 text-neutral-600',
  };

  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
}
