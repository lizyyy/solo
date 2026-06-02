import { getStatusText, getStatusColor } from '@/utils/export';
import { AlertTriangle, CheckCircle, Clock, Eye, Loader } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

const statusIcons: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  verified: CheckCircle,
  resolved: CheckCircle,
  pending: Clock,
  processing: Loader,
  verify: AlertTriangle,
  review: Eye,
};

export default function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const Icon = statusIcons[status];
  const colorClass = getStatusColor(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}
    >
      {showIcon && Icon && <Icon className="w-3.5 h-3.5" />}
      {getStatusText(status)}
    </span>
  );
}
