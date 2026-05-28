import type { RiskStatus, ActionStatus } from '@/types/game';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  type: 'risk' | 'action';
  status: RiskStatus | ActionStatus;
}

export function StatusBadge({ type, status }: StatusBadgeProps) {
  const getRiskStyles = (s: RiskStatus) => {
    switch (s) {
      case 'normal':
        return 'bg-liquidity-good/20 text-liquidity-good border-liquidity-good/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'danger':
        return 'bg-liquidity-danger/20 text-liquidity-danger border-liquidity-danger/30 pulse-warning';
    }
  };

  const getActionStyles = (s: ActionStatus) => {
    switch (s) {
      case 'tentative':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30 italic';
      case 'confirmed':
        return 'bg-gold-500/20 text-gold-400 border-gold-500/50 font-medium';
    }
  };

  const getLabel = () => {
    if (type === 'risk') {
      const labels: Record<RiskStatus, string> = {
        normal: '正常',
        warning: '警告',
        danger: '危险',
      };
      return labels[status as RiskStatus];
    }
    const labels: Record<ActionStatus, string> = {
      tentative: '临时',
      confirmed: '已确认',
    };
    return labels[status as ActionStatus];
  };

  const styles = type === 'risk' 
    ? getRiskStyles(status as RiskStatus) 
    : getActionStyles(status as ActionStatus);

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-xs rounded border',
      styles
    )}>
      {getLabel()}
    </span>
  );
}
