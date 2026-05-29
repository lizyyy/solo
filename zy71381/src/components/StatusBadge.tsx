import React from 'react';
import type { DependencyStatus } from '../types';
import { DEPENDENCY_STATUS_LABELS } from '../types';
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  FileQuestion,
  ShieldAlert,
  FileCheck,
  FileX,
  ThumbsUp,
  ThumbsDown,
  FileText,
} from 'lucide-react';

interface StatusBadgeProps {
  status: DependencyStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const icons: Record<DependencyStatus, React.ReactNode> = {
  pending_parse: <Clock className="w-3 h-3" />,
  parsing: <Loader2 className="w-3 h-3 animate-spin" />,
  parsed_normal: <CheckCircle className="w-3 h-3" />,
  parsed_dirty: <FileQuestion className="w-3 h-3" />,
  pending_review: <Clock className="w-3 h-3" />,
  reviewing: <Loader2 className="w-3 h-3 animate-spin" />,
  approved: <ThumbsUp className="w-3 h-3" />,
  blocked: <ShieldAlert className="w-3 h-3" />,
  waiver_pending: <FileText className="w-3 h-3" />,
  waiver_approved: <FileCheck className="w-3 h-3" />,
  waiver_rejected: <FileX className="w-3 h-3" />,
  in_report: <CheckCircle className="w-3 h-3" />,
};

const colorClasses: Record<DependencyStatus, string> = {
  pending_parse: 'bg-slate-100 text-slate-600',
  parsing: 'bg-blue-100 text-blue-600',
  parsed_normal: 'bg-emerald-100 text-emerald-600',
  parsed_dirty: 'bg-amber-100 text-amber-600',
  pending_review: 'bg-slate-100 text-slate-600',
  reviewing: 'bg-blue-100 text-blue-600',
  approved: 'bg-emerald-100 text-risk-safe',
  blocked: 'bg-red-100 text-risk-critical',
  waiver_pending: 'bg-orange-100 text-orange-600',
  waiver_approved: 'bg-blue-100 text-risk-waiver',
  waiver_rejected: 'bg-red-100 text-risk-critical',
  in_report: 'bg-primary-100 text-primary-700',
};

export function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps) {
  const icon = icons[status];
  const label = DEPENDENCY_STATUS_LABELS[status];
  const colorClass = colorClasses[status];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0' : '';

  return (
    <span className={`badge ${colorClass} ${sizeClass} inline-flex items-center gap-1`}>
      {showIcon && icon}
      {label}
    </span>
  );
}
