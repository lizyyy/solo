import { FileStatus, ConflictResolution } from '@/types';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  status: FileStatus | ConflictResolution | 'unresolved' | 'matched' | 'unmatched' | 'manual';
  text?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, text, size = 'md' }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs';
  
  const config = getStatusConfig(status);
  
  return (
    <span className={`status-badge ${config.className} ${sizeClass} inline-flex items-center gap-1`}>
      {config.icon && <config.icon className="w-3 h-3" />}
      {text || config.text}
    </span>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'success':
    case 'matched':
    case 'manual':
      return {
        className: 'status-success',
        text: '正常',
        icon: CheckCircle2,
      };
    case 'warning':
      return {
        className: 'status-warning',
        text: '有异常',
        icon: AlertTriangle,
      };
    case 'error':
      return {
        className: 'status-error',
        text: '失败',
        icon: XCircle,
      };
    case 'processing':
      return {
        className: 'status-processing',
        text: '处理中',
        icon: Loader2,
      };
    case 'unmatched':
      return {
        className: 'status-warning',
        text: '待关联',
        icon: AlertTriangle,
      };
    case 'unresolved':
      return {
        className: 'status-error',
        text: '待处理',
        icon: AlertTriangle,
      };
    case 'use_a':
      return {
        className: 'status-success',
        text: '采用A方',
        icon: CheckCircle2,
      };
    case 'use_b':
      return {
        className: 'status-success',
        text: '采用B方',
        icon: CheckCircle2,
      };
    case 'keep_both':
      return {
        className: 'status-success',
        text: '两边都保留',
        icon: CheckCircle2,
      };
    default:
      return {
        className: 'bg-gray-100 text-gray-600',
        text: status,
        icon: null,
      };
  }
}
