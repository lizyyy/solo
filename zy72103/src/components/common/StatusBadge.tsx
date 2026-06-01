import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface StatusBadgeProps {
  type: 'danger' | 'warning' | 'success' | 'info' | 'normal';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export function StatusBadge({ type, children, size = 'md' }: StatusBadgeProps) {
  const configs = {
    danger: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertTriangle,
    },
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: CheckCircle,
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: Info,
    },
    normal: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-400',
      icon: CheckCircle,
    },
  };

  const config = configs[type];
  const Icon = config.icon;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${config.bg} ${config.border} ${config.text} ${sizeClass} font-medium`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {children}
    </span>
  );
}
