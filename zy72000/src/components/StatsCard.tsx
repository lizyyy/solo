import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { RedemptionStatus } from '@/types';
import { formatCurrency } from '@/utils';
import { STATUS_LABELS } from '@/data/constants';

interface StatsCardProps {
  status: RedemptionStatus | 'total';
  count: number;
  amount: number;
}

const config = {
  confirmed: {
    icon: CheckCircle,
    bgClass: 'bg-status-confirmed-light',
    borderClass: 'border-status-confirmed',
    textClass: 'text-status-confirmed',
    iconClass: 'text-status-confirmed',
  },
  pending: {
    icon: Clock,
    bgClass: 'bg-status-pending-light',
    borderClass: 'border-status-pending',
    textClass: 'text-status-pending',
    iconClass: 'text-status-pending',
  },
  manual: {
    icon: AlertTriangle,
    bgClass: 'bg-status-manual-light',
    borderClass: 'border-status-manual',
    textClass: 'text-status-manual',
    iconClass: 'text-status-manual',
  },
  total: {
    icon: CheckCircle,
    bgClass: 'bg-primary-50',
    borderClass: 'border-primary-200',
    textClass: 'text-primary-600',
    iconClass: 'text-primary-500',
  },
};

export default function StatsCard({ status, count, amount }: StatsCardProps) {
  const cfg = config[status];
  const Icon = cfg.icon;
  const label = status === 'total' ? '合计' : STATUS_LABELS[status];

  return (
    <div className={`card p-5 ${cfg.bgClass} border-l-4 ${cfg.borderClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${cfg.textClass} mb-1`}>{count} 笔</p>
          <p className="text-sm text-gray-600 text-currency">{formatCurrency(amount)}</p>
        </div>
        <Icon className={`w-8 h-8 ${cfg.iconClass} opacity-70`} />
      </div>
    </div>
  );
}
