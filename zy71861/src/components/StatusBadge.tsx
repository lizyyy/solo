import { ChainStatus } from '@/types';
import { getStatusLabel } from '@/utils/chainBuilder';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: ChainStatus;
  className?: string;
}

const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const configs: Record<ChainStatus, { bg: string; text: string; icon: React.ElementType; pulse?: boolean }> = {
    confirmed: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: CheckCircle
    },
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: Clock
    },
    conflict: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: AlertTriangle,
      pulse: true
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} ${config.pulse ? 'animate-pulse-slow' : ''} ${className}`}>
      <Icon className="w-4 h-4" />
      <span>{getStatusLabel(status)}</span>
    </span>
  );
};

export default StatusBadge;
